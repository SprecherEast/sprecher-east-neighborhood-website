// Test helpers for the Umami scripts (#948): a fake Umami API, stubbed `docker`, `caddy`, `getent`
// and Caddy reload, and a server-shaped folder tree in a temp directory. Not a test file itself.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach } from 'vitest'

export const OPS = path.dirname(fileURLToPath(import.meta.url))
export const SECRET = 'correct-horse-battery-staple'
export const DEFAULT = 'umami'

export function write(file, text, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, { mode })
}

/** Registers beforeEach/afterEach and returns the helpers; call it once at the top of a test file. */
export function setUpUmamiHarness() {
  const h = { dir: '', port: 0, state: {}, server: null }

  const stub = (name, body) =>
    write(path.join(h.dir, 'bin', name), `#!/usr/bin/env bash\n${body}\n`, 0o755)
  const p = (...parts) => path.join(h.dir, ...parts)

  async function startFakeUmami() {
    h.state = {
      admin: DEFAULT,
      heartbeat: 200,
      loginStatus: null,
      ignoreChange: false,
      twoFactor: false,
      requests: [],
    }
    h.server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (d) => (raw += d))
      req.on('end', () => {
        h.state.requests.push(`${req.method} ${req.url}`)
        const send = (code, body = {}) => {
          res.writeHead(code, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(body))
        }
        const body = raw ? JSON.parse(raw) : {}
        if (req.url === '/api/heartbeat') return send(h.state.heartbeat, { ok: true })
        if (req.url === '/api/auth/login') {
          if (h.state.loginStatus) return send(h.state.loginStatus)
          if (body.username === 'admin' && body.password === h.state.admin) {
            // With two-factor sign-in on, Umami answers 200 with no token (docs.umami.is/docs/api/authentication).
            if (h.state.twoFactor)
              return send(200, { requiresTwoFactor: true, partialToken: 'partial' })
            return send(200, { token: 'fake-token', user: { username: 'admin' } })
          }
          return send(401, { error: 'unauthorized' })
        }
        if (req.url === '/api/me/password') {
          if (req.headers.authorization !== 'Bearer fake-token') return send(401)
          if (body.currentPassword !== h.state.admin) return send(400)
          if (!h.state.ignoreChange) h.state.admin = body.newPassword
          return send(200, { username: 'admin' })
        }
        return send(404)
      })
    })
    await new Promise((resolve) => h.server.listen(0, '127.0.0.1', resolve))
    return h.server.address().port
  }

  beforeEach(async () => {
    h.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umami-'))
    h.port = await startFakeUmami()
    write(p('app/.env.local'), 'NEXT_PUBLIC_SERVER_URL=https://sprechereast.com\n')
    // The release the scripts run from: the real scripts and files, plus stubbed backups.
    for (const f of fs
      .readdirSync(OPS)
      .filter(
        (n) =>
          /^(lib|umami-[a-z]+)\.sh$/.test(n) ||
          n === 'install-umami.sh' ||
          n === 'backup-umami.sh' ||
          n === 'deploy-release.sh',
      )) {
      write(p('code/ops', f), fs.readFileSync(path.join(OPS, f)))
    }
    for (const f of ['umami/compose.yaml', 'caddy/umami.caddy', 'caddy/umami-closed.caddy']) {
      write(p('code/ops', f), fs.readFileSync(path.join(OPS, f)))
    }
    write(p('code/ops/backup.sh'), 'echo "backup.sh $*" >> "$STUB_LOG"\n')
    write(p('caddy/Caddyfile'), 'sprechereast.com {\n\treverse_proxy localhost:3000\n}\n')
    write(p('caddy/hsts.caddy'), 'header Strict-Transport-Security "max-age=300"\n')
    write(p('meminfo'), 'MemTotal: 4000000 kB\nMemAvailable: 3000000 kB\n')
    fs.writeFileSync(p('log'), '')
    stub(
      'docker',
      [
        '[ "$1" = compose ] || exit 1',
        'shift; args="$*"; echo "docker $args" >> "$STUB_LOG"',
        'case "$args" in',
        '  version*) exit 0 ;;',
        '  *" ps "*) last="${@: -1}"; case "$last" in umami|db) case " $STUB_RUNNING " in *" $last "*) echo abc123 ;; esac ;; *) [ -z "$STUB_RUNNING" ] || echo abc123 ;; esac ;;',
        '  *" up "*) echo "route at up: $(cat "$STUB_ROUTE_FILE" 2>/dev/null | tr -d "\\n\\t")" >> "$STUB_LOG"; [ -z "$STUB_UP_FAILS" ] ;;',
        '  *" exec "*) [ -z "$STUB_DUMP_FAILS" ] && echo "-- dump" || exit 1 ;;',
        'esac',
      ].join('\n'),
    )
    stub('getent', '[ -z "$STUB_NO_DNS" ]')
    stub('caddy', '[ "$1" != validate ] || [ -z "$STUB_CADDY_REJECTS" ]')
    stub(
      'cp',
      'case "$*" in *bak-umami*) [ -z "$STUB_CP_FAILS" ] || exit 1 ;; esac; exec /bin/cp "$@"',
    )
    stub('openssl', '[ -z "$STUB_OPENSSL_FAILS" ] || exit 1; exec /usr/bin/openssl "$@"')
    stub('mktemp', '[ -z "$STUB_MKTEMP_FAILS" ] || exit 1; exec /usr/bin/mktemp "$@"')
    stub('reload-caddy', 'echo reload >> "$STUB_LOG"')
  })

  afterEach(async () => {
    await new Promise((resolve) => h.server.close(resolve))
    fs.rmSync(h.dir, { recursive: true, force: true })
  })

  /** Runs a script from the fake release; `env` adds to or overrides the server-shaped defaults. */
  h.run = (script, env = {}, args = [], input = undefined) => {
    const full = {
      PATH: `${p('bin')}:${process.env.PATH}`,
      HOME: h.dir,
      APP_DIR: p('app'),
      UMAMI_DIR: p('umami'),
      UMAMI_PORT: String(h.port),
      CADDYFILE: p('caddy/Caddyfile'),
      UMAMI_CADDY_FILE: p('caddy/sprecher-east-umami.caddy'),
      HSTS_FILE: p('caddy/hsts.caddy'),
      RELOAD_CADDY: p('bin/reload-caddy'),
      MEMINFO: p('meminfo'),
      BACKUP_ROOT: p('backups'),
      PUBLIC_BASE: `http://127.0.0.1:${h.port}`,
      PUBLIC_CURL_ARGS: '',
      UP_WAIT: '1',
      PUBLIC_WAIT: '1',
      STUB_LOG: p('log'),
      STUB_ROUTE_FILE: p('caddy/sprecher-east-umami.caddy'),
      UMAMI_ADMIN_PASSWORD: SECRET,
      ...env,
    }
    return new Promise((resolve) => {
      const child = spawn('bash', [p('code/ops', script), ...args], { env: full })
      if (input !== undefined) child.stdin.end(input)
      let out = ''
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (out += d))
      child.on('close', (code) => resolve({ code, out, log: fs.readFileSync(p('log'), 'utf8') }))
    })
  }
  h.install = (env) => h.run('install-umami.sh', env)
  h.p = p
  h.caddyfile = () => fs.readFileSync(p('caddy/Caddyfile'), 'utf8')
  h.route = () => fs.readFileSync(p('caddy/sprecher-east-umami.caddy'), 'utf8')
  h.envFile = () => fs.readFileSync(p('umami/.env'), 'utf8')
  return h
}
