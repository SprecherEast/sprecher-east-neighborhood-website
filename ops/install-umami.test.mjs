import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const OPS = path.dirname(fileURLToPath(import.meta.url))
const SECRET = 'correct-horse-battery-staple'
const DEFAULT = 'umami'

let dir
let server
let state

/** A stand-in for Umami's API as documented at docs.umami.is: heartbeat, login, change password. */
async function startFakeUmami() {
  state = { admin: DEFAULT, heartbeat: 200, loginStatus: null, ignoreChange: false, requests: [] }
  server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      state.requests.push(`${req.method} ${req.url}`)
      const send = (code, body = {}) => {
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      const body = raw ? JSON.parse(raw) : {}
      if (req.url === '/api/heartbeat') return send(state.heartbeat, { ok: true })
      if (req.url === '/api/auth/login') {
        if (state.loginStatus) return send(state.loginStatus)
        if (body.username === 'admin' && body.password === state.admin) {
          return send(200, { token: 'fake-token', user: { username: 'admin' } })
        }
        return send(401, { error: 'unauthorized' })
      }
      if (req.url === '/api/me/password') {
        if (req.headers.authorization !== 'Bearer fake-token') return send(401)
        if (body.currentPassword !== state.admin) return send(400)
        if (!state.ignoreChange) state.admin = body.newPassword
        return send(200, { username: 'admin' })
      }
      return send(404)
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}

function write(file, text, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, { mode })
}

function stub(name, body) {
  write(path.join(dir, 'bin', name), `#!/usr/bin/env bash\n${body}\n`, 0o755)
}

let port

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-umami-'))
  port = await startFakeUmami()
  // The server's app folder and the release the scripts run from.
  write(path.join(dir, 'app/.env.local'), 'NEXT_PUBLIC_SERVER_URL=https://sprechereast.com\n')
  for (const f of ['umami/compose.yaml', 'caddy/umami.caddy']) {
    write(path.join(dir, 'code/ops', f), fs.readFileSync(path.join(OPS, f)))
  }
  write(path.join(dir, 'code/ops/backup.sh'), 'echo "backup.sh $*" >> "$STUB_LOG"\n')
  write(path.join(dir, 'code/ops/backup-umami.sh'), 'echo "backup-umami.sh $*" >> "$STUB_LOG"\n')
  write(
    path.join(dir, 'caddy/Caddyfile'),
    'sprechereast.com {\n\treverse_proxy localhost:3000\n}\n',
  )
  write(path.join(dir, 'caddy/hsts.caddy'), 'header Strict-Transport-Security "max-age=300"\n')
  write(path.join(dir, 'meminfo'), 'MemTotal: 4000000 kB\nMemAvailable: 3000000 kB\n')
  fs.writeFileSync(path.join(dir, 'log'), '')
  stub(
    'docker',
    '[ "$1" = compose ] || exit 1\nshift\nargs="$*"\necho "docker $args" >> "$STUB_LOG"\ncase "$args" in\n  version*) exit 0 ;;\n  *" ps "*) [ -z "$STUB_RUNNING" ] || echo abc123 ;;\n  *" up "*) [ -z "$STUB_UP_FAILS" ] ;;\nesac',
  )
  stub('reload-caddy', 'echo reload >> "$STUB_LOG"')
  stub('getent', '[ -z "$STUB_NO_DNS" ]')
  stub('caddy', '[ "$1" != validate ] || [ -z "$STUB_CADDY_REJECTS" ]')
})

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve))
  fs.rmSync(dir, { recursive: true, force: true })
})

function run(env = {}) {
  const full = {
    PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
    HOME: dir,
    APP_DIR: path.join(dir, 'app'),
    CODE_DIR: path.join(dir, 'code'),
    UMAMI_DIR: path.join(dir, 'umami'),
    UMAMI_PORT: String(port),
    CADDYFILE: path.join(dir, 'caddy/Caddyfile'),
    UMAMI_CADDY_FILE: path.join(dir, 'caddy/sprecher-east-umami.caddy'),
    HSTS_FILE: path.join(dir, 'caddy/hsts.caddy'),
    RELOAD_CADDY: path.join(dir, 'bin/reload-caddy'),
    MEMINFO: path.join(dir, 'meminfo'),
    PUBLIC_BASE: `http://127.0.0.1:${port}`,
    PUBLIC_CURL_ARGS: '',
    UP_WAIT: '1',
    PUBLIC_WAIT: '1',
    STUB_LOG: path.join(dir, 'log'),
    UMAMI_ADMIN_PASSWORD: SECRET,
    ...env,
  }
  return new Promise((resolve) => {
    const child = spawn('bash', [path.join(OPS, 'install-umami.sh')], { env: full })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) =>
      resolve({ code, out, log: fs.readFileSync(path.join(dir, 'log'), 'utf8') }),
    )
  })
}

const caddyfile = () => fs.readFileSync(path.join(dir, 'caddy/Caddyfile'), 'utf8')
const envFile = () => fs.readFileSync(path.join(dir, 'umami/.env'), 'utf8')
const untouched = (log) => {
  expect(log).not.toContain(' up ')
  expect(fs.existsSync(path.join(dir, 'umami'))).toBe(false)
  expect(caddyfile()).not.toContain('umami')
}

describe('install-umami.sh: skips, safely', () => {
  it('does nothing and says what is missing when neither the secret nor the DNS name exists', async () => {
    const { code, out, log } = await run({ UMAMI_ADMIN_PASSWORD: '', STUB_NO_DNS: '1' })
    expect(code).toBe(0)
    expect(out).toContain('::notice')
    expect(out).toContain('UMAMI_ADMIN_PASSWORD')
    expect(out).toContain('stats.sprechereast.com')
    untouched(log)
  })

  it('does nothing when only the secret is missing', async () => {
    const { code, out, log } = await run({ UMAMI_ADMIN_PASSWORD: '' })
    expect(code).toBe(0)
    expect(out).toContain('UMAMI_ADMIN_PASSWORD')
    expect(out).not.toContain('DNS name')
    untouched(log)
  })

  it('does nothing when only the DNS name is missing', async () => {
    const { code, out, log } = await run({ STUB_NO_DNS: '1' })
    expect(code).toBe(0)
    expect(out).toContain('DNS name stats.sprechereast.com')
    expect(out).not.toContain('UMAMI_ADMIN_PASSWORD')
    untouched(log)
  })

  it.each(['short', 'twelve-chars', 'has\nline-break-in-it'])(
    'refuses a weak password: %j',
    async (pw) => {
      const { code, out, log } = await run({
        UMAMI_ADMIN_PASSWORD: pw === 'twelve-chars' ? 'umami' : pw,
      })
      expect(code).toBe(0)
      expect(out).toContain('::warning')
      expect(out).toContain('at least 12 characters')
      untouched(log)
    },
  )

  it('refuses, with a warning, when free memory is short', async () => {
    fs.writeFileSync(path.join(dir, 'meminfo'), 'MemAvailable: 500000 kB\n')
    const { code, out, log } = await run()
    expect(code).toBe(0)
    expect(out).toContain('::warning')
    expect(out).toContain('memory')
    expect(log).not.toContain(' up ')
  })

  it('does not check memory for Umami that is already running', async () => {
    write(path.join(dir, 'umami/.env'), 'UMAMI_PORT=1\n')
    fs.writeFileSync(path.join(dir, 'meminfo'), 'MemAvailable: 500000 kB\n')
    const { code } = await run({ STUB_RUNNING: '1' })
    expect(code).toBe(0)
  })
})

describe('install-umami.sh: install', () => {
  it('backs up, starts, replaces the default password, then exposes it through Caddy', async () => {
    const { code, out, log } = await run()
    expect(out).toContain('Umami is live at https://stats.sprechereast.com')
    expect(code).toBe(0)
    expect(log).toContain('backup.sh pre-deploy')
    expect(log).toContain(' up -d')
    expect(state.admin).toBe(SECRET)
    expect(state.requests).toContain('POST /api/me/password')
    expect(out).toContain('default admin password was replaced')
    expect(out).toContain('rejects its default admin password')
    expect(log).toContain('reload')

    const block = fs.readFileSync(path.join(dir, 'caddy/sprecher-east-umami.caddy'), 'utf8')
    expect(block).toContain(`stats.sprechereast.com {`)
    expect(block).toContain(`reverse_proxy 127.0.0.1:${port}`)
    expect(block).not.toMatch(/__UMAMI/)
    expect(caddyfile()).toContain(`import ${path.join(dir, 'caddy/sprecher-east-umami.caddy')}`)
    expect(caddyfile()).toContain('reverse_proxy localhost:3000') // the site's own block is untouched
  })

  it('writes generated secrets to a root-only file and never prints a secret', async () => {
    const { out } = await run()
    const env = envFile()
    expect(env).toMatch(/^UMAMI_DB_PASSWORD=[0-9a-f]{64}$/m)
    expect(env).toMatch(/^UMAMI_APP_SECRET=[0-9a-f]{64}$/m)
    expect(env).toMatch(/^UMAMI_TWO_FACTOR_KEY=[0-9a-f]{64}$/m)
    expect(fs.statSync(path.join(dir, 'umami/.env')).mode & 0o077).toBe(0)
    for (const secret of [SECRET, ...env.match(/[0-9a-f]{64}/g), 'fake-token']) {
      expect(out).not.toContain(secret)
    }
  })

  it('keeps its secrets, its Caddy line and the password on the next deploy', async () => {
    await run()
    const first = envFile()
    const { code, out, log } = await run({ STUB_RUNNING: '1', MEMINFO: '/nonexistent' })
    expect(code).toBe(0)
    expect(envFile()).toBe(first)
    expect(out).toContain('already the one in the secret')
    expect(log).toContain('backup-umami.sh pre-deploy')
    expect(caddyfile().match(/import /g)).toHaveLength(1)
    expect(state.requests.filter((r) => r === 'POST /api/me/password')).toHaveLength(1)
  })

  it('leaves a password someone changed by hand as it is, and still exposes it', async () => {
    state.admin = 'a-password-set-in-the-umami-ui'
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('changed by hand')
    expect(state.admin).toBe('a-password-set-in-the-umami-ui')
  })
})

describe('install-umami.sh: never exposed with the default password', () => {
  it('stops without exposing when the default password still works after the change', async () => {
    state.ignoreChange = true
    const { code, out } = await run()
    expect(code).toBe(1)
    expect(out).toContain('::error')
    expect(caddyfile()).not.toContain('umami')
    expect(fs.existsSync(path.join(dir, 'caddy/sprecher-east-umami.caddy'))).toBe(false)
  })

  it('stops without exposing when the login answers something unexpected', async () => {
    state.loginStatus = 500
    const { code, out } = await run()
    expect(code).toBe(1)
    expect(out).toContain('::error')
    expect(caddyfile()).not.toContain('umami')
  })

  it('stops without exposing when Umami never answers', async () => {
    state.heartbeat = 503
    const { code, out } = await run()
    expect(code).toBe(1)
    expect(out).toContain('did not answer')
    expect(caddyfile()).not.toContain('umami')
  })

  it('stops when the containers cannot start', async () => {
    const { code, out } = await run({ STUB_UP_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('could not start')
    expect(caddyfile()).not.toContain('umami')
  })

  it('stops when the pre-deploy backup fails, before starting anything', async () => {
    write(path.join(dir, 'code/ops/backup.sh'), 'exit 1\n')
    const { code, log } = await run()
    expect(code).toBe(1)
    expect(log).not.toContain(' up ')
  })
})

describe('install-umami.sh: Caddy', () => {
  it('leaves Caddy alone, with a warning, when it rejects the block', async () => {
    const before = caddyfile()
    const { code, out } = await run({ STUB_CADDY_REJECTS: '1' })
    expect(code).toBe(0)
    expect(out).toContain('did not accept')
    expect(caddyfile()).toBe(before)
    expect(fs.existsSync(path.join(dir, 'caddy/sprecher-east-umami.caddy'))).toBe(false)
  })

  it('leaves Caddy alone, with a warning, when the HSTS file is not there', async () => {
    fs.rmSync(path.join(dir, 'caddy/hsts.caddy'))
    const before = caddyfile()
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain('running but not exposed')
    expect(caddyfile()).toBe(before)
  })

  it('puts the old Caddyfile back and fails when Caddy will not reload', async () => {
    const before = caddyfile()
    const { code, out } = await run({ RELOAD_CADDY: '/bin/false' })
    expect(code).toBe(1)
    expect(out).toContain('taken out again')
    expect(caddyfile()).toBe(before)
  })

  it('warns, without failing, when the HTTPS address does not answer yet', async () => {
    const { code, out } = await run({ PUBLIC_BASE: 'http://127.0.0.1:1' })
    expect(code).toBe(0)
    expect(out).toContain('did not answer')
  })
})
