// Shared set-up for the tests that run the real deploy-release.sh and restart-app.sh against a
// server-shaped tree in a temp directory (#1073). `pm2`, `curl`, the housekeeping scripts and the
// build are stubs that write to a log. Real Caddy and PM2 are checked on the server.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach } from 'vitest'

import { OPS, write } from './umami-harness.mjs'

export const PROD_URL = 'https://sprechereast.com'
export const PREVIEW_URL = 'https://pr-7.dev.sprechereast.com'
export const HOUSEKEEPING = [
  'install-cron',
  'caddy-limits',
  'caddy-https',
  'caddy-previews',
  'install-umami',
]
const CONFIG_OF = `const a = require(require("path").resolve(process.argv[1])).apps[0]; console.log(JSON.stringify([a.name, a.env.PORT, a.cwd]))`

/** Registers the per-test folder and stubs; returns the helpers that work inside it. */
export function setUpEnvironmentHarness() {
  let dir = ''
  const p = (...parts) => path.join(dir, ...parts)
  const stub = (name, body) =>
    write(p('bin', name), `#!/usr/bin/env bash\n${[body].flat().join('\n')}\n`, 0o755)
  const log = () => fs.readFileSync(p('log'), 'utf8')

  /** A release folder with the real scripts, a fake build and logging stand-ins for the rest. */
  function makeRelease(release, url) {
    for (const f of [
      'deploy-release.sh',
      'restart-app.sh',
      'lib.sh',
      'environment.sh',
      'migrate-lib.sh',
    ])
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
      '  jlist) cat "$STUB_STATE/jlist" 2>/dev/null || echo "[]" ;;',
      `  start) touch "$STUB_STATE/$4"; echo "config $(node -e '${CONFIG_OF}' "$2")" >> "$STUB_LOG" ;;`,
      '  delete) rm -f "$STUB_STATE/$2" ;;',
      'esac',
    ])
    write(p('app/.env.local'), `NEXT_PUBLIC_SERVER_URL=${PROD_URL}\n`)
    write(p('previews/pr-7/.env.local'), `NEXT_PUBLIC_SERVER_URL=${PREVIEW_URL}\n`)
    write(p('caddy/previews/pr-7.caddy'), '# a block\n')
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  /** Runs `script` (deploy-release.sh or restart-app.sh) from `release`; `env` adds to the defaults. */
  function runScript(release, script, env = {}) {
    return new Promise((resolve) => {
      const child = spawn('bash', [path.join(release, 'ops', script)], {
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
  const deploy = (release, env) => runScript(release, 'deploy-release.sh', env)

  return { p, stub, log, makeRelease, runScript, deploy }
}
