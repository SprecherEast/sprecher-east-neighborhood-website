// deploy-release.sh for production (no environment named) and for one pull request preview
// (#1073). `pm2`, `curl`, the housekeeping scripts and the build are stubs that write to a log; the
// folders are a server-shaped tree in a temp directory. Real Caddy and PM2 are checked on the server.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { OPS, write } from './umami-harness.mjs'

const PROD_URL = 'https://sprechereast.com'
const PREVIEW_URL = 'https://pr-7.dev.sprechereast.com'
const HOUSEKEEPING = [
  'install-cron',
  'caddy-limits',
  'caddy-https',
  'caddy-previews',
  'install-umami',
]
const CONFIG_OF = `const a = require(require("path").resolve(process.argv[1])).apps[0]; console.log(JSON.stringify([a.name, a.env.PORT, a.cwd]))`

let dir = ''
const p = (...parts) => path.join(dir, ...parts)
const stub = (name, body) =>
  write(p('bin', name), `#!/usr/bin/env bash\n${[body].flat().join('\n')}\n`, 0o755)
const log = () => fs.readFileSync(p('log'), 'utf8')

/** A release folder with the real scripts, a fake build and logging stand-ins for the rest. */
function makeRelease(release, url) {
  for (const f of ['deploy-release.sh', 'restart-app.sh', 'lib.sh', 'environment.sh'])
    write(path.join(release, 'ops', f), fs.readFileSync(path.join(OPS, f)))
  write(
    path.join(release, 'ecosystem.config.cjs'),
    fs.readFileSync(path.join(OPS, '..', 'ecosystem.config.cjs')),
  )
  for (const f of ['backup', ...HOUSEKEEPING])
    write(path.join(release, 'ops', `${f}.sh`), `echo "${f}.sh $*" >> "$STUB_LOG"\n`)
  write(
    path.join(release, '.release-info'),
    `node=${process.version}\nserver_url=${url}\nturnstile_site_key=\n`,
  )
  write(path.join(release, '.next/BUILD_ID'), 'build\n')
  fs.mkdirSync(path.join(release, 'public'), { recursive: true }) // committed with the code
  write(path.join(release, 'node_modules/.bin/next'), '#!/bin/sh\n', 0o755)
  write(
    path.join(release, 'node_modules/.bin/payload'),
    `#!/bin/sh\necho "payload $* in $(pwd -P)" >> "$STUB_LOG"\n`,
    0o755,
  )
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'environment-'))
  fs.writeFileSync(p('log'), '')
  fs.mkdirSync(p('state'))
  stub('node', 'case "$*" in *sharp*) exit 0 ;; esac; exec ' + process.execPath + ' "$@"')
  stub('curl', [
    'echo "curl $*" >> "$STUB_LOG"',
    '[ -z "$STUB_SITE_DOWN" ] || { case "$*" in *-w*) echo 000 ;; esac; exit 0; }',
    'case "$*" in *-w*) echo 200 ;; *api/version) echo \'{"buildId":"build"}\' ;; *) echo ok ;; esac',
  ])
  stub('pm2', [
    'echo "pm2 $*" >> "$STUB_LOG"',
    'case "$1" in',
    '  describe) [ -f "$STUB_STATE/$2" ] ;;',
    '  jlist) echo "[]" ;;',
    `  start) touch "$STUB_STATE/$4"; echo "config $(node -e '${CONFIG_OF}' "$2")" >> "$STUB_LOG" ;;`,
    '  delete) rm -f "$STUB_STATE/$2" ;;',
    'esac',
  ])
  write(p('app/.env.local'), `NEXT_PUBLIC_SERVER_URL=${PROD_URL}\n`)
  write(p('previews/pr-7/.env.local'), `NEXT_PUBLIC_SERVER_URL=${PREVIEW_URL}\n`)
  write(p('caddy/previews/pr-7.caddy'), '# a block\n')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

/** Runs deploy-release.sh from `release`; `env` adds to the server-shaped defaults. */
function deploy(release, env = {}) {
  return new Promise((resolve) => {
    const child = spawn('bash', [path.join(release, 'ops/deploy-release.sh')], {
      env: {
        PATH: `${p('bin')}:${process.env.PATH}`,
        STUB_LOG: p('log'),
        STUB_STATE: p('state'),
        APP_DIR: p('app'),
        CODE_DIR: release,
        UP_SECONDS: '2',
        DEADLINE_SECONDS: '2',
        CADDYFILE: p('caddy/Caddyfile'),
        PREVIEW_ROOT: p('previews'),
        PREVIEW_CADDY_DIR: p('caddy/previews'),
        ...env,
      },
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ code, out }))
  })
}
const production = () => {
  const release = p('app/releases/r1')
  makeRelease(release, PROD_URL)
  return deploy(release)
}
const preview = (env = {}, number = '7') => {
  const release = p(`previews/pr-${number}/releases/r1`)
  makeRelease(release, PREVIEW_URL)
  return deploy(release, { PREVIEW_NUMBER: number, ...env })
}
const curlUrls = () =>
  log()
    .split('\n')
    .filter((l) => l.startsWith('curl '))
    .map((l) => l.split(' ').at(-1))

describe('deploy-release.sh with no environment named', () => {
  it('does what it did before: production’s folder, process, settings and site, with every step', async () => {
    const { code, out } = await production()
    expect(code).toBe(0)
    expect(out).toContain('release r1 is live')
    expect(log()).toContain('pm2 start ecosystem.config.cjs --only sprecher-east\n')
    expect(log()).toContain('config ["sprecher-east",3000,"' + p('app/current') + '"]')
    expect(log()).toContain('backup.sh pre-deploy')
    for (const f of HOUSEKEEPING) expect(log()).toContain(`${f}.sh`)
    expect(new Set(curlUrls().map((u) => new URL(u).origin))).toEqual(new Set([PROD_URL]))
    expect(fs.readlinkSync(p('app/releases/r1/.env.local'))).toBe(p('app/.env.local'))
    expect(fs.readlinkSync(p('app/releases/r1/data'))).toBe(p('app/data'))
    expect(fs.readlinkSync(p('app/releases/r1/public/media'))).toBe(p('app/public/media'))
    expect(fs.readlinkSync(p('app/current'))).toBe('releases/r1')
  })

  it('keeps the newest three releases', async () => {
    for (const [i, name] of ['o1', 'o2', 'o3'].entries()) {
      fs.mkdirSync(p('app/releases', name), { recursive: true })
      fs.utimesSync(p('app/releases', name), 100 + i, 100 + i)
    }
    await production()
    expect(fs.readdirSync(p('app/releases')).sort()).toEqual(['o2', 'o3', 'r1'])
  })
})

describe('deploy-release.sh for a preview', () => {
  it('uses its own folder, process, port, settings, data, media and site, and never production’s', async () => {
    const { code, out } = await preview()
    expect(out).toContain('release r1 is live (build build), preview 7')
    expect(code).toBe(0)
    expect(log()).toContain('pm2 start ecosystem.config.cjs --only sprecher-east-pr-7\n')
    expect(log()).toContain(
      'config ["sprecher-east-pr-7",3207,"' + p('previews/pr-7/current') + '"]',
    )
    expect(log()).toContain(`payload migrate in ${fs.realpathSync(p('previews/pr-7/releases/r1'))}`)
    const release = p('previews/pr-7/releases/r1')
    expect(fs.readlinkSync(`${release}/.env.local`)).toBe(p('previews/pr-7/.env.local'))
    expect(fs.readlinkSync(`${release}/data`)).toBe(p('previews/pr-7/data'))
    expect(fs.readlinkSync(`${release}/public/media`)).toBe(p('previews/pr-7/public/media'))
    expect(fs.readlinkSync(p('previews/pr-7/current'))).toBe('releases/r1')
    expect(new Set(curlUrls().map((u) => new URL(u).origin))).toEqual(new Set([PREVIEW_URL]))
    expect(fs.readdirSync(p('app'))).toEqual(['.env.local']) // production's folder is untouched
    expect(log()).not.toContain('--only sprecher-east\n')
  })

  it('skips the backups, the production Caddy scripts, the cron install and the Umami install', async () => {
    await preview()
    for (const f of ['backup', ...HOUSEKEEPING]) expect(log()).not.toContain(`${f}.sh`)
  })

  it('keeps the newest two releases', async () => {
    for (const [i, name] of ['o1', 'o2', 'o3'].entries()) {
      fs.mkdirSync(p('previews/pr-7/releases', name), { recursive: true })
      fs.utimesSync(p('previews/pr-7/releases', name), 100 + i, 100 + i)
    }
    await preview()
    expect(fs.readdirSync(p('previews/pr-7/releases')).sort()).toEqual(['o3', 'r1'])
  })

  it('still runs the settings gates against the preview’s own settings', async () => {
    fs.appendFileSync(p('previews/pr-7/.env.local'), 'NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA\n')
    const { code, out } = await preview()
    expect(code).toBe(1)
    expect(out).toContain('Turnstile site key')
    expect(log()).not.toContain('pm2 start')
  })

  it('stops before changing anything when its Caddy block is not in place', async () => {
    fs.rmSync(p('caddy/previews/pr-7.caddy'))
    const { code, out } = await preview()
    expect(code).toBe(1)
    expect(out).toContain('::error title=Server::')
    expect(out).toContain('Caddy block')
    expect(log()).not.toContain('pm2')
    expect(fs.existsSync(p('previews/pr-7/current'))).toBe(false)
  })

  it('stops when something else already listens on its port', async () => {
    const server = net.createServer()
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = String(server.address().port)
    const env = { PREVIEW_PORT_MIN: port, PREVIEW_PORT_MAX: port }
    try {
      const { code, out } = await preview(env)
      expect(code).toBe(1)
      expect(out).toContain(`port ${port} is already in use`)
      expect(log()).not.toContain('pm2 start')
      // the same preview, already running, may keep its own port
      fs.writeFileSync(p('state/sprecher-east-pr-7'), '')
      expect((await preview(env)).code).toBe(0)
    } finally {
      server.close()
    }
  })

  it('takes down a first deploy that never answered, rather than leaving a broken preview', async () => {
    const { code, out } = await preview({ STUB_SITE_DOWN: 'yes' })
    expect(code).toBe(1)
    expect(out).toContain('::error title=Server::')
    expect(out).toContain('the preview was not put live')
    expect(log()).toContain('pm2 delete sprecher-east-pr-7')
    expect(fs.existsSync(p('previews/pr-7/current'))).toBe(false)
    expect(log()).not.toContain('old checkout')
  }, 30000)
})
