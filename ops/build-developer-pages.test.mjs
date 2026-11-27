// ops/build-developer-pages.sh (#1530): the developer pages' build that ships in a release. `npm` is a
// stand-in that writes what the static export writes (or fails, or takes too long); the real build is run
// by the pull request's checks. The rules it shares with the showcase build (optional or required, nothing
// left behind, a folder inside the release) are in optional-build-lib.sh and tested in build-showcase.test.mjs.
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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-developer-pages-'))
  fs.mkdirSync(p())
  // `npm run developer:build`: writes developer/out and developer/.next unless STUB_NPM says otherwise
  write(
    path.join(dir, 'bin/npm'),
    [
      '#!/usr/bin/env bash',
      'echo "npm $*" >> "$STUB_LOG"',
      '[ "$STUB_NPM" != slow ] || sleep 20',
      'mkdir -p developer/.next developer/out/showcase developer/out/_next/static',
      'echo cache > developer/.next/cache',
      '[ "$STUB_NPM" = no-home ] || echo built > developer/out/index.html',
      '[ "$STUB_NPM" = no-404 ] || echo built > developer/out/404.html',
      '[ "$STUB_NPM" = no-showcase ] || echo built > developer/out/showcase/index.html',
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
    const child = spawn('bash', [path.join(OPS, 'build-developer-pages.sh'), ...args], {
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

describe('build-developer-pages.sh: a build that works', () => {
  it('runs the repo’s own script, moves the export to the folder and drops the build cache', async () => {
    const { code, out } = await build(['developer-site/pages', 'yes'])
    expect(code, out).toBe(0)
    expect(fs.readFileSync(path.join(dir, 'log'), 'utf8')).toBe('npm run developer:build\n')
    for (const file of ['index.html', '404.html', 'showcase/index.html'])
      expect(exists('developer-site/pages', file)).toBe(true)
    expect(exists('developer/out')).toBe(false)
    expect(exists('developer/.next')).toBe(false)
    expect(out).toContain('built into developer-site/pages')
  })
})

describe('build-developer-pages.sh: how long it may take', () => {
  it('gives the build three minutes when the caller names no limit, so a hung build holds the release up briefly', async () => {
    write(
      path.join(dir, 'bin/timeout'),
      '#!/usr/bin/env bash\necho "timeout $*" >> "$STUB_LOG"\nshift 3\nexec "$@"\n',
      0o755,
    )
    expect((await build(['developer-site/pages', 'yes'])).code).toBe(0)
    expect(fs.readFileSync(path.join(dir, 'log'), 'utf8')).toContain(
      'timeout -k 10 180 npm run developer:build\n',
    )
  })
})

describe('build-developer-pages.sh: a build that does not work', () => {
  for (const [what, env] of [
    ['fails', { STUB_NPM: 'fail' }],
    ['leaves no home page', { STUB_NPM: 'no-home' }],
    ['leaves no 404 page', { STUB_NPM: 'no-404' }],
    ['leaves no showcase page', { STUB_NPM: 'no-showcase' }],
    ['takes too long', { STUB_NPM: 'slow', DEVELOPER_PAGES_SECONDS: '1' }],
  ]) {
    it(`when optional, only warns if it ${what}, and leaves nothing behind`, async () => {
      const { code, out } = await build(['developer-site/pages', 'yes'], env)
      expect(code, out).toBe(0)
      expect(out).toContain('::warning title=Developer pages::')
      expect(out).not.toContain('::error')
      expect(exists('developer-site')).toBe(false)
      expect(exists('developer/out')).toBe(false)
      expect(exists('developer/.next')).toBe(false)
    })

    it(`when required, fails if it ${what}`, async () => {
      const { code, out } = await build(['developer-site/pages', 'no'], env)
      expect(code).toBe(1)
      expect(out).toContain('::error title=Developer pages::')
      expect(exists('developer-site')).toBe(false)
    })
  }

  it('refuses a folder outside the release, and builds nothing', async () => {
    const { code, out } = await build(['../pages', 'yes'])
    expect(code).toBe(2)
    expect(out).toContain('path inside the release')
    expect(fs.readFileSync(path.join(dir, 'log'), 'utf8')).toBe('')
  })
})

describe('where the developer pages are built into a release (#1530)', () => {
  const root = path.join(OPS, '..')
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
  const script = read('ops/build-release.sh')
  const at = (needle) => script.indexOf(needle)

  it('builds them only when a folder is named, optional unless the caller says otherwise', () => {
    expect(script).toContain(
      'if [ -n "${DEVELOPER_PAGES_DEST:-}" ]; then bash ops/build-developer-pages.sh "$DEVELOPER_PAGES_DEST" "${DEVELOPER_PAGES_OPTIONAL:-no}"; fi',
    )
  })

  it('builds them with the dev dependencies still installed, and before the packages are pruned', () => {
    expect(at('then bash ops/build-developer-pages.sh')).toBeGreaterThan(at('npm ci --no-audit'))
    expect(at('then bash ops/build-developer-pages.sh')).toBeLessThan(at('npm prune'))
  })

  it('has the production deploy build them as optional, into the folder the developer site reads', () => {
    const deploy = read('.github/workflows/deploy.yml')
    expect(deploy).toContain('DEVELOPER_PAGES_DEST: developer-site/pages')
    expect(deploy).toContain("DEVELOPER_PAGES_OPTIONAL: 'yes'")
    expect(read('ops/developer-site.sh')).toContain('$CODE_DIR/developer-site/pages')
  })

  it('never builds them in a pull request preview: the pages are not part of the site there', () => {
    expect(read('.github/workflows/preview.yml')).not.toMatch(/DEVELOPER_PAGES/)
  })
})
