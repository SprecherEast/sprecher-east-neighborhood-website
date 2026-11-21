// Shared set-up for the tests of the restricted preview account (#1345): a server-shaped tree in a
// temp directory with the real scripts copied the way ops/install-preview-access.sh copies them,
// and stand-ins for `sudo`, `caddy`, `pm2`, the Caddy reload and `id`. Real sudo, sshd and Caddy
// are checked on the server (ops/README.md, "Pull request preview account").
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach } from 'vitest'

import { OPS, write } from './umami-harness.mjs'

export const COMMIT = 'a'.repeat(40)
export const SCRIPTS = [
  'preview-wrapper.sh',
  'preview-caddy.sh',
  'preview-access-lib.sh',
  'preview-isolation-check.sh',
  'preview-host-guards.sh',
  'umami-lib.sh',
  'preview-settings.sh',
  'secret-lib.sh',
  'deploy-release.sh',
  'restart-app.sh',
  'migrate-lib.sh',
  'caddy-lock-lib.sh',
  'lib.sh',
  'environment.sh',
]
export const CADDY_FILES = ['preview-site.caddy', 'preview-headers.caddy']

/** Runs a command and resolves with its exit code and all its output. */
export function runCommand(command, args, { env, input, cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, cwd })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ code, out }))
    child.stdin.on('error', () => {}) // the script may stop reading
    child.stdin.end(input ?? '')
  })
}

/** Registers beforeEach/afterEach and returns the helpers; call it once at the top of a test file. */
export function setUpPreviewAccessHarness() {
  let dir = ''
  const p = (...parts) => path.join(dir, ...parts)
  const stub = (name, body) => write(p('bin', name), `#!/usr/bin/env bash\n${body}\n`, 0o755)
  const log = () => fs.readFileSync(p('log'), 'utf8')

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-access-'))
    fs.writeFileSync(p('log'), '')
    // The root-owned copy of main's scripts, as the installer makes it.
    for (const f of SCRIPTS) write(p('access/ops', f), fs.readFileSync(path.join(OPS, f)), 0o755)
    // The root script fixes its own PATH. A test run puts its stand-ins (caddy, id) first in it; a test
    // that the real value is the secure one runs the unmodified script.
    const rootScript = fs.readFileSync(path.join(OPS, 'preview-caddy.sh'), 'utf8')
    write(
      p('access/ops/preview-caddy.sh'),
      rootScript.replace(/^SECURE_PATH=/m, `SECURE_PATH=${p('bin')}:`),
      0o755,
    )
    for (const f of CADDY_FILES)
      write(p('access/ops/caddy', f), fs.readFileSync(path.join(OPS, 'caddy', f)))
    // The isolation check has its own tests (preview-isolation-check.test.mjs); here it is a stand-in that
    // logs each run and fails when STUB_ISOLATION_FAILS is set, or after the first STUB_ISOLATION_PASSES runs.
    write(
      p('access/ops/preview-isolation-check.sh'),
      [
        '#!/bin/bash',
        'echo "isolation-check $0" >> "$STUB_LOG"',
        'runs=$(grep -c "^isolation-check " "$STUB_LOG")',
        '[ -z "${STUB_ISOLATION_FAILS-}" ] || exit 1',
        '[ -z "${STUB_ISOLATION_PASSES-}" ] || [ "$runs" -le "$STUB_ISOLATION_PASSES" ]',
        '',
      ].join('\n'),
      0o755,
    )
    write(p('access/tools-path'), `${p('bin')}\n`)
    // Caddy's side.
    write(
      p('caddy/Caddyfile'),
      `sprechereast.com {\n\treverse_proxy localhost:3000\n}\nimport ${p('caddy/previews')}/*.caddy\n`,
    )
    fs.mkdirSync(p('caddy/previews'))
    write(p('caddy/headers.caddy'), fs.readFileSync(path.join(OPS, 'caddy/preview-headers.caddy')))
    write(p('caddy/limits.caddy'), '# the form limits\n')
    fs.mkdirSync(p('previews'))
    // `id -u` says 1000 (a test is not root) unless STUB_UID is set; everything else is the real one.
    stub('id', 'if [ "$1" = -u ]; then echo "${STUB_UID:-1000}"; else exec /usr/bin/id "$@"; fi')
    // sudo -n <command…>: runs it, and records that it was asked to.
    stub('sudo', 'echo "sudo $*" >> "$STUB_LOG"; [ "$1" = -n ] && shift; exec "$@"')
    stub('pm2', 'echo "pm2 $*" >> "$STUB_LOG"')
    stub('node', `exec ${process.execPath} "$@"`)
    // `caddy validate --config <file> --adapter caddyfile` fails for a file with STUB_CADDY_REJECTS in
    // it, or (for the Caddyfile) for an imported previews block that has it.
    stub(
      'caddy',
      [
        '[ "$1" = validate ] || exit 0',
        'echo "validate $(basename "$3")" >> "$STUB_LOG"',
        // what Caddy's glob would already pick up while a candidate block is being checked
        '[ "$(basename "$3")" = Caddyfile ] || echo "visible-blocks $(ls "$STUB_PREVIEW_DIR"/*.caddy 2>/dev/null | wc -l)" >> "$STUB_LOG"',
        // a config that is fine alone but not with this block in the folder
        // a config that is fine only while this block is still in the folder
        '[ -z "$STUB_WHOLE_NEEDS" ] || [ "$(basename "$3")" != Caddyfile ] || [ -f "$STUB_PREVIEW_DIR/$STUB_WHOLE_NEEDS" ] || exit 1',
        '[ -z "$STUB_WHOLE_REJECTS" ] || [ "$(basename "$3")" != Caddyfile ] || ! cat "$STUB_PREVIEW_DIR"/*.caddy 2>/dev/null | grep -q "$STUB_WHOLE_REJECTS" || exit 1',
        '[ -z "$STUB_CADDY_REJECTS" ] && exit 0',
        'grep -q "$STUB_CADDY_REJECTS" "$3" && exit 1',
        'for f in "$STUB_PREVIEW_DIR"/*.caddy; do [ ! -f "$f" ] || ! grep -q "$STUB_CADDY_REJECTS" "$f" || exit 1; done',
        'exit 0',
      ].join('\n'),
    )
    // The reload fails when STUB_RELOAD_FAILS is set and the block folder holds the word in it.
    stub(
      'reload-caddy',
      [
        'echo "reload $(cat "$STUB_PREVIEW_DIR"/*.caddy 2>/dev/null | md5sum | cut -c1-8)" >> "$STUB_LOG"',
        '[ -z "$STUB_RELOAD_FAILS" ] || ! cat "$STUB_PREVIEW_DIR"/*.caddy 2>/dev/null | grep -q "$STUB_RELOAD_FAILS"',
      ].join('\n'),
    )
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  const baseEnv = (extra = {}) => ({
    PATH: `${p('bin')}:${process.env.PATH}`,
    STUB_LOG: p('log'),
    STUB_PREVIEW_DIR: p('caddy/previews'),
    PREVIEW_ROOT: p('previews'),
    PREVIEW_CADDY_DIR: p('caddy/previews'),
    PREVIEW_ACCESS_DIR: p('access'),
    PREVIEW_HEADERS_FILE: p('caddy/headers.caddy'),
    LIMITS_FILE: p('caddy/limits.caddy'),
    CADDYFILE: p('caddy/Caddyfile'),
    RELOAD_CADDY: p('bin/reload-caddy'),
    PM2_HOME: p('previews/.pm2'),
    ...extra,
  })

  /** Runs the installed wrapper the way sshd does: the request in SSH_ORIGINAL_COMMAND, stdin the archive. */
  const wrapper = (request, { input, env } = {}) =>
    runCommand('/bin/bash', [p('access/ops/preview-wrapper.sh')], {
      env: baseEnv({ ...(request === undefined ? {} : { SSH_ORIGINAL_COMMAND: request }), ...env }),
      input,
    })

  /** Runs the installed Caddy script with exactly these arguments. */
  const caddyScript = (args, env) =>
    runCommand('/bin/bash', [p('access/ops/preview-caddy.sh'), ...args], { env: baseEnv(env) })

  return { p, stub, log, baseEnv, wrapper, caddyScript }
}
