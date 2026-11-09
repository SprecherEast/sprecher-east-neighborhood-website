import fs from 'node:fs'
import http from 'node:http'

import { describe, expect, it } from 'vitest'

import { setUpUmamiHarness } from './umami-harness.mjs'

const h = setUpUmamiHarness()

const closed = () => {
  expect(h.route()).toContain('respond "Unavailable" 503')
  expect(h.route()).not.toContain('reverse_proxy')
  expect(h.caddyfile()).toContain('sprecher-east-umami.caddy')
}

const CLOSED_AT_START = /route at up: .*respond "Unavailable" 503/

describe('install-umami.sh: closes an address that is open when securing fails', () => {
  const openInstall = async () => {
    await h.install() // opened
    expect(h.route()).toContain('reverse_proxy')
    fs.writeFileSync(h.p('log'), '')
  }

  it('closes it when Umami is running behind the open proxy and its password cannot be secured', async () => {
    await openInstall()
    h.state.admin = 'umami'
    h.state.ignoreChange = true
    const { code, out } = await h.install({ STUB_RUNNING: 'umami db' })
    expect(code).toBe(1)
    expect(out).toContain('Umami stays closed to the public')
    closed()
  })

  it('closes it when the public check does not get 401 for the default password', async () => {
    await openInstall()
    const other = http.createServer((req, res) => res.writeHead(200).end('{}'))
    await new Promise((resolve) => other.listen(0, '127.0.0.1', resolve))
    try {
      const { code, out } = await h.install({
        STUB_RUNNING: 'umami db',
        PUBLIC_BASE: `http://127.0.0.1:${other.address().port}`,
      })
      expect(code).toBe(1)
      expect(out).toContain('not 401')
      closed()
    } finally {
      await new Promise((resolve) => other.close(resolve))
    }
  })

  it('closes it when an unexpected error follows the start', async () => {
    await openInstall()
    const { code, out } = await h.install({ STUB_RUNNING: 'umami db', STUB_NODE_FAILS: '1' })
    expect(code).toBe(1)
    expect(out).toContain('failed unexpectedly')
    expect(out).toContain('its public address is closed')
    closed()
  })
})

describe('install-umami.sh: closes what Caddy serves, not what the files seem to say', () => {
  it('reloads Caddy before the start even when the route file already holds the closed block', async () => {
    await h.install() // Caddy serves the proxy
    fs.copyFileSync(
      h.p('code/ops/caddy/umami-closed.caddy'),
      h.p('caddy/sprecher-east-umami.caddy'),
    )
    fs.writeFileSync(
      h.p('caddy/sprecher-east-umami.caddy'),
      fs
        .readFileSync(h.p('code/ops/caddy/umami-closed.caddy'), 'utf8')
        .replace('__UMAMI_HOST__', 'stats.sprechereast.com'),
    ) // a run killed between the write and the reload left this on disk
    fs.writeFileSync(h.p('log'), '')
    h.state.admin = 'umami'
    const { code, log } = await h.install()
    expect(code).toBe(0)
    expect(log.indexOf('reload')).toBeGreaterThan(-1)
    expect(log.indexOf('reload')).toBeLessThan(log.indexOf(' up -d'))
  })

  it('closes it when the import line was edited by hand (indent, trailing space)', async () => {
    await h.install()
    const route = h.p('caddy/sprecher-east-umami.caddy')
    fs.writeFileSync(
      h.p('caddy/Caddyfile'),
      h.caddyfile().replace(`import ${route}`, `\t import   ${route}  `),
    )
    h.state.admin = 'umami'
    const { code, log } = await h.install()
    expect(code).toBe(0)
    expect(log).toMatch(CLOSED_AT_START)
    expect(h.caddyfile().match(/import /g)).toHaveLength(1) // and no second import line was added
  })

  it('closes it even when a skip ends the run (secret missing, DNS failing, weak password)', async () => {
    await h.install()
    for (const env of [
      { UMAMI_ADMIN_PASSWORD: '' },
      { STUB_NO_DNS: '1' },
      { UMAMI_ADMIN_PASSWORD: 'short' },
    ]) {
      fs.writeFileSync(
        h.p('caddy/sprecher-east-umami.caddy'),
        'stats.sprechereast.com {\n\treverse_proxy 127.0.0.1:1\n}\n',
      )
      const { code } = await h.install(env)
      expect(code).toBe(0)
      closed()
    }
  })
})
