import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { setUpUmamiHarness } from './umami-harness.mjs'

const h = setUpUmamiHarness()

const closed = () => {
  expect(h.route()).toContain('respond "Unavailable" 503')
  expect(h.route()).not.toContain('reverse_proxy')
  expect(h.caddyfile()).toContain('sprecher-east-umami.caddy') // still imported, now closed
}

describe('install-umami.sh: never public with the default password', () => {
  it('closes the address before it starts Umami on a database that came back empty', async () => {
    await h.install() // first install: opened
    expect(h.route()).toContain('reverse_proxy')
    h.state.admin = 'umami' // the database was emptied; Umami is not running any more
    const { code, log } = await h.install()
    expect(code).toBe(0)
    expect(log).toMatch(/route at up: .*respond "Unavailable" 503/) // closed at the moment of `up`
    expect(log).not.toMatch(/route at up: .*reverse_proxy/)
    expect(h.route()).toContain('reverse_proxy') // and open again once the password was replaced
    expect(h.state.admin).not.toBe('umami')
  })

  it('leaves it closed, and says so, when the default password cannot be replaced', async () => {
    await h.install()
    h.state.admin = 'umami'
    h.state.ignoreChange = true
    const { code, out } = await h.install()
    expect(code).toBe(1)
    expect(out).toContain('Umami stays closed to the public')
    closed()
  })

  it('leaves it closed when Umami never answers', async () => {
    await h.install()
    h.state.heartbeat = 503
    const { code, out } = await h.install()
    expect(code).toBe(1)
    expect(out).toContain('did not answer')
    closed()
  })

  it('leaves it closed when the login answers something unexpected', async () => {
    await h.install()
    h.state.loginStatus = 500
    const { code } = await h.install()
    expect(code).toBe(1)
    closed()
  })

  it('leaves it closed when the containers cannot start', async () => {
    await h.install()
    const { code, out } = await h.install({ STUB_UP_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('could not start')
    closed()
  })

  it('starts nothing when the address could not be closed first', async () => {
    await h.install()
    const before = fs.readFileSync(h.p('log'), 'utf8')
    const { code, out, log } = await h.install({ RELOAD_CADDY: '/bin/false' })
    expect(code).toBe(1)
    expect(out).toContain('could not be closed, so nothing was started')
    expect(log.slice(before.length)).not.toContain(' up ')
  })

  it('closes it when only the database is running: a database alone is not Umami', async () => {
    await h.install()
    h.state.admin = 'umami' // an emptied database, brought up on its own (the restore steps)
    const { code, log } = await h.install({ STUB_RUNNING: 'db' })
    expect(code).toBe(0)
    expect(log).toMatch(/route at up: .*respond "Unavailable" 503/)
    expect(log).not.toMatch(/route at up: .*reverse_proxy/)
    expect(h.state.admin).not.toBe('umami')
    expect(h.route()).toContain('reverse_proxy') // opened again after the password was replaced
  })

  it('closes it before refusing to start for lack of memory', async () => {
    await h.install()
    fs.writeFileSync(h.p('meminfo'), 'MemAvailable: 500000 kB\n')
    const { code, out } = await h.install()
    expect(code).toBe(0)
    expect(out).toContain('memory')
    closed()
  })

  it('does not close the address of Umami that is already running', async () => {
    await h.install()
    const { code, log } = await h.install({ STUB_RUNNING: 'umami db' })
    expect(code).toBe(0)
    expect(log).toMatch(/route at up: .*reverse_proxy/)
  })

  it('has nothing to close on a first install, and never opens it on failure', async () => {
    h.state.ignoreChange = true
    const { code, log } = await h.install()
    expect(code).toBe(1)
    expect(log).toContain('route at up: \n')
    expect(h.caddyfile()).not.toContain('umami')
    expect(fs.existsSync(h.p('caddy/sprecher-east-umami.caddy'))).toBe(false)
  })
})

describe('install-umami.sh: Caddy', () => {
  it('leaves Caddy alone, with a warning, when it rejects the block', async () => {
    const before = h.caddyfile()
    const { code, out } = await h.install({ STUB_CADDY_REJECTS: '1' })
    expect(code).toBe(0)
    expect(out).toContain('could not be put in place')
    expect(h.caddyfile()).toBe(before)
    expect(fs.existsSync(h.p('caddy/sprecher-east-umami.caddy'))).toBe(false)
  })

  it('leaves Caddy alone, with a warning, when the HSTS file is not there', async () => {
    fs.rmSync(h.p('caddy/hsts.caddy'))
    const before = h.caddyfile()
    const { code, out } = await h.install()
    expect(code).toBe(0)
    expect(out).toContain('was not opened')
    expect(h.caddyfile()).toBe(before)
  })

  it('puts the old Caddyfile back and fails when Caddy will not reload', async () => {
    const before = h.caddyfile()
    const { code, out } = await h.install({ RELOAD_CADDY: '/bin/false' })
    expect(code).toBe(1)
    expect(out).toContain('put back')
    expect(h.caddyfile()).toBe(before)
  })

  it('keeps the Caddyfile readable by the user Caddy runs as', async () => {
    fs.chmodSync(h.p('caddy/Caddyfile'), 0o644)
    await h.install()
    expect(fs.statSync(h.p('caddy/Caddyfile')).mode & 0o777).toBe(0o644)
  })

  it('adds no import line, and leaves no route file, when the Caddyfile backup cannot be written', async () => {
    const before = h.caddyfile()
    const { code, out } = await h.install({ STUB_CP_FAILS: '1' })
    expect(code).toBe(0)
    expect(out).toContain('could not be put in place')
    expect(h.caddyfile()).toBe(before)
    expect(fs.existsSync(h.p('caddy/sprecher-east-umami.caddy'))).toBe(false)
  })

  it('warns, without failing, when the HTTPS address does not answer yet', async () => {
    const { code, out } = await h.install({ PUBLIC_BASE: 'http://127.0.0.1:1' })
    expect(code).toBe(0)
    expect(out).toContain('did not answer')
  })
})

describe('install-umami.sh: other failures', () => {
  it('writes no empty secret when openssl fails, and starts nothing', async () => {
    const { code, out, log } = await h.install({ STUB_OPENSSL_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('could not generate its secrets')
    expect(fs.existsSync(h.p('umami/.env'))).toBe(false)
    expect(log).not.toContain(' up ')
  })

  it('says the address is closed when an unexpected error follows the start', async () => {
    const { code, out } = await h.install({ STUB_MKTEMP_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('failed unexpectedly')
    expect(out).toContain('its public address is closed')
  })
})
