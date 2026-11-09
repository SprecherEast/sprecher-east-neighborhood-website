import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { setUpUmamiHarness } from './umami-harness.mjs'

const h = setUpUmamiHarness()

const closed = () => {
  expect(h.route()).toContain('respond "Unavailable" 503')
  expect(h.route()).not.toContain('reverse_proxy')
}
const CLOSED_AT_START = /route at up: .*respond "Unavailable" 503/

describe('install-umami.sh: the guards before the address opens', () => {
  it('never opens the address when the default password is still accepted after the change', async () => {
    h.state.alwaysDefault = true
    const { code, out, log } = await h.install()
    expect(code).toBe(1)
    expect(out).toContain('still accepts its default admin password')
    expect(out).toContain('stays closed')
    expect(fs.existsSync(h.p('caddy/sprecher-east-umami.caddy'))).toBe(false) // first install: never opened
    expect(h.caddyfile()).not.toContain('import')
    expect(log).toContain('stop umami') // the backstop when Caddy is not what keeps it closed
  })

  it('leaves the address closed, not open, when Umami still accepts the default password on a later run', async () => {
    await h.install()
    h.state.alwaysDefault = true
    const { code } = await h.install({ STUB_RUNNING: 'umami db' })
    expect(code).toBe(1)
    closed()
  })

  it('keeps the route file, and says so, when Caddy will not reload and the Caddyfile cannot be put back', async () => {
    const { code, out } = await h.install({
      RELOAD_CADDY: '/bin/false',
      STUB_CP_RESTORE_FAILS: '1',
    })
    expect(code).toBe(1)
    expect(out).toContain('could not be put back from')
    expect(out).toContain('bak-umami')
    expect(fs.existsSync(h.p('caddy/sprecher-east-umami.caddy'))).toBe(true) // the import line still resolves
  })
})

describe('install-umami.sh: when Umami counts as secured', () => {
  it('closes the address when Umami runs but its database does not', async () => {
    await h.install()
    h.state.admin = 'umami'
    const { code, log } = await h.install({ STUB_RUNNING: 'umami' })
    expect(code).toBe(0)
    expect(log).toMatch(CLOSED_AT_START)
  })

  it('leaves the address alone when Umami and its database both run', async () => {
    await h.install()
    const { code, log } = await h.install({ STUB_RUNNING: 'umami db' })
    expect(code).toBe(0)
    expect(log).not.toMatch(CLOSED_AT_START)
  })

  it('keeps the memory check on Umami alone: a running Umami is not refused for memory', async () => {
    await h.install()
    fs.writeFileSync(h.p('meminfo'), 'MemAvailable: 100 kB\n')
    const { code, out } = await h.install({ STUB_RUNNING: 'umami' })
    expect(code).toBe(0)
    expect(out).not.toContain('was not started')
  })
})

describe('install-umami.sh: the route file and the import line', () => {
  it('closes it when the import line has a trailing comment', async () => {
    await h.install()
    const route = h.p('caddy/sprecher-east-umami.caddy')
    fs.writeFileSync(
      h.p('caddy/Caddyfile'),
      h.caddyfile().replace(`import ${route}`, `import ${route} # umami`),
    )
    h.state.admin = 'umami'
    const { code, log } = await h.install()
    expect(code).toBe(0)
    expect(log).toMatch(CLOSED_AT_START)
    expect(h.caddyfile().match(/import /g)).toHaveLength(1)
  })

  it('writes the closed block and reloads when the route file was deleted but is still imported', async () => {
    await h.install()
    fs.rmSync(h.p('caddy/sprecher-east-umami.caddy'))
    h.state.admin = 'umami'
    const { code, log } = await h.install()
    expect(code).toBe(0)
    expect(log).toMatch(CLOSED_AT_START)
  })

  it('keeps the closed block on disk when the reload of the close fails', async () => {
    await h.install()
    fs.writeFileSync(
      h.p('caddy/sprecher-east-umami.caddy'),
      'stats.sprechereast.com {\n\treverse_proxy 127.0.0.1:1\n}\n',
    )
    const { code, out } = await h.install({ RELOAD_CADDY: '/bin/false' })
    expect(code).toBe(1)
    expect(out).toContain('could not be closed')
    closed() // what the next start of Caddy loads
  })
})

describe('install-umami.sh: compose up is bounded', () => {
  it('stops waiting for a start that hangs, and leaves the address closed', async () => {
    const { code, out } = await h.install({ STUB_UP_HANGS: '1', UP_TIMEOUT: '1' })
    expect(code).toBe(1)
    expect(out).toContain('could not start Umami')
    expect(fs.existsSync(h.p('caddy/sprecher-east-umami.caddy'))).toBe(false)
  })
})
