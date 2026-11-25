// ops/build-showcase.sh (#1459): the showcase build that ships in a release. `npm` is a stand-in that
// writes what Storybook writes (or fails, or takes too long); the real build is run by the pull request.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { OPS } from './umami-harness.mjs'

let dir = ''
const p = (...parts) => path.join(dir, 'release', ...parts)
const write = (file, text = 'x\n', mode) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, { mode })
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-showcase-'))
  fs.mkdirSync(p())
  // `npm run storybook:build`: writes storybook-static unless STUB_NPM says otherwise
  write(
    path.join(dir, 'bin/npm'),
    [
      '#!/usr/bin/env bash',
      'echo "npm $*" >> "$STUB_LOG"',
      '[ "$STUB_NPM" != slow ] || sleep 20',
      '[ "$STUB_NPM" != brief ] || sleep 2',
      '[ "$STUB_NPM" != writes-nothing ] || exit 0',
      'mkdir -p storybook-static/assets',
      '[ "$STUB_NPM" = no-index ] || echo built > storybook-static/index.html',
      '[ "$STUB_NPM" = no-iframe ] || echo built > storybook-static/iframe.html',
      '[ "$STUB_NPM" = fail ] && exit 3',
      'exit 0',
      '',
    ].join('\n'),
    0o755,
  )
  fs.writeFileSync(path.join(dir, 'log'), '')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const build = (args, env = {}) =>
  new Promise((resolve) => {
    const child = spawn('bash', [path.join(OPS, 'build-showcase.sh'), ...args], {
      cwd: p(),
      env: {
        PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
        STUB_LOG: path.join(dir, 'log'),
        ...env,
      },
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ code, out }))
  })
const exists = (...parts) => fs.existsSync(p(...parts))

describe('build-showcase.sh: a build that works', () => {
  it('runs the repo’s own showcase script and moves its output to the folder', async () => {
    const { code, out } = await build(['developer-site/showcase', 'yes'])
    expect(code, out).toBe(0)
    expect(fs.readFileSync(path.join(dir, 'log'), 'utf8')).toBe('npm run storybook:build\n')
    expect(exists('developer-site/showcase/index.html')).toBe(true)
    expect(exists('developer-site/showcase/iframe.html')).toBe(true)
    expect(exists('storybook-static')).toBe(false)
    expect(out).toContain('built into developer-site/showcase')
  })

  it('gives the build ten minutes when the caller names no limit', async () => {
    const { code, out } = await build(['public/showcase'], { STUB_NPM: 'brief' })
    expect(code, out).toBe(0)
    expect(exists('public/showcase/index.html')).toBe(true)
  })

  it('never ships the output of an earlier build when this one wrote nothing', async () => {
    write(p('storybook-static/index.html'), 'stale\n')
    write(p('storybook-static/iframe.html'), 'stale\n')
    const { code } = await build(['public/showcase'], { STUB_NPM: 'writes-nothing' })
    expect(code).toBe(1)
    expect(exists('public/showcase')).toBe(false)
    expect(exists('storybook-static')).toBe(false)
  })

  it('replaces what an earlier build left in the folder, so nothing old is shipped', async () => {
    write(p('public/showcase/old-file.js'))
    const { code } = await build(['public/showcase'])
    expect(code).toBe(0)
    expect(exists('public/showcase/old-file.js')).toBe(false)
    expect(exists('public/showcase/index.html')).toBe(true)
  })

  it('starts from a clean output folder, so a leftover one is never shipped as a build', async () => {
    write(p('storybook-static/index.html'))
    write(p('storybook-static/iframe.html'))
    const { code } = await build(['public/showcase', 'yes'], { STUB_NPM: 'fail' })
    expect(code).toBe(0)
    expect(exists('public/showcase')).toBe(false)
  })
})

describe('build-showcase.sh: a build that does not work', () => {
  for (const [what, env] of [
    ['fails', { STUB_NPM: 'fail' }],
    ['leaves no index page', { STUB_NPM: 'no-index' }],
    ['leaves no iframe page', { STUB_NPM: 'no-iframe' }],
    ['takes too long', { STUB_NPM: 'slow', SHOWCASE_SECONDS: '1' }],
  ]) {
    it(`when optional, only warns if it ${what}, and leaves nothing behind`, async () => {
      const { code, out } = await build(['developer-site/showcase', 'yes'], env)
      expect(code, out).toBe(0)
      expect(out).toContain('::warning title=Showcase::')
      expect(out).not.toContain('::error')
      expect(exists('developer-site')).toBe(false)
      expect(exists('storybook-static')).toBe(false)
    })

    it(`when required, fails if it ${what}, and leaves nothing behind`, async () => {
      const { code, out } = await build(['public/showcase', 'no'], env)
      expect(code).toBe(1)
      expect(out).toContain('::error title=Showcase::')
      expect(exists('public')).toBe(false)
      expect(exists('storybook-static')).toBe(false)
    })
  }

  it('is required unless it is told it is optional', async () => {
    const { code } = await build(['public/showcase'], { STUB_NPM: 'fail' })
    expect(code).toBe(1)
  })
})

describe('build-showcase.sh: the folder must be inside the release', () => {
  for (const bad of ['', '/tmp/showcase', '..', '../showcase', 'a/../../showcase', 'a/..'])
    it(`refuses ${JSON.stringify(bad)} and builds nothing`, async () => {
      const { code, out } = await build([bad, 'yes'])
      expect(code).toBe(2)
      expect(out).toContain('path inside the release')
      expect(fs.readFileSync(path.join(dir, 'log'), 'utf8')).toBe('')
    })

  it('refuses no argument at all', async () => {
    expect((await build([])).code).toBe(2)
  })
})

describe('build-release.sh: when the showcase is built', () => {
  const script = fs.readFileSync(path.join(OPS, 'build-release.sh'), 'utf8')
  const at = (needle) => script.indexOf(needle)

  it('builds it only when a folder is named, with the optional flag the caller gives (required by default)', () => {
    expect(script).toContain(
      'if [ -n "${SHOWCASE_DEST:-}" ]; then bash ops/build-showcase.sh "$SHOWCASE_DEST" "${SHOWCASE_OPTIONAL:-no}"; fi',
    )
  })

  it('builds it before the site, so a showcase in public/ is there at build time, and before dev dependencies go', () => {
    expect(at('then bash ops/build-showcase.sh')).toBeGreaterThan(at('npm ci --no-audit'))
    expect(at('then bash ops/build-showcase.sh')).toBeLessThan(at('npm run build'))
    expect(at('npm run build')).toBeLessThan(at('npm prune'))
  })
})
