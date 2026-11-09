import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SECRET, setUpUmamiHarness, write } from './umami-harness.mjs'

const h = setUpUmamiHarness()

const untouched = (log) => {
  expect(log).not.toContain(' up ')
  expect(fs.existsSync(h.p('umami'))).toBe(false)
  expect(h.caddyfile()).not.toContain('umami')
}

describe('install-umami.sh: skips, safely', () => {
  it('does nothing and says what is missing when neither the secret nor the DNS name exists', async () => {
    const { code, out, log } = await h.install({ UMAMI_ADMIN_PASSWORD: '', STUB_NO_DNS: '1' })
    expect(code).toBe(0)
    expect(out).toContain('::notice')
    expect(out).toContain(
      'the UMAMI_ADMIN_PASSWORD secret and the DNS name stats.sprechereast.com are not set up yet',
    )
    untouched(log)
  })

  it('does nothing when only the secret is missing', async () => {
    const { code, out, log } = await h.install({ UMAMI_ADMIN_PASSWORD: '' })
    expect(code).toBe(0)
    expect(out).toContain('the UMAMI_ADMIN_PASSWORD secret is not set up yet')
    expect(out).not.toContain('DNS name')
    untouched(log)
  })

  it('does nothing when only the DNS name is missing', async () => {
    const { code, out, log } = await h.install({ STUB_NO_DNS: '1' })
    expect(code).toBe(0)
    expect(out).toContain('the DNS name stats.sprechereast.com is not set up yet')
    expect(out).not.toContain('UMAMI_ADMIN_PASSWORD')
    untouched(log)
  })

  it('says "updated", and changes nothing, when the secret goes missing after an install', async () => {
    write(h.p('umami/.env'), 'UMAMI_PORT=1\n')
    const { code, out, log } = await h.install({ UMAMI_ADMIN_PASSWORD: '' })
    expect(code).toBe(0)
    expect(out).toContain('Umami was not updated')
    expect(log).not.toContain(' up ')
  })

  it.each(['short', 'umami', 'has\nline-break-in-it'])(
    'refuses a weak password: %j',
    async (pw) => {
      const { code, out, log } = await h.install({ UMAMI_ADMIN_PASSWORD: pw })
      expect(code).toBe(0)
      expect(out).toContain('::warning')
      expect(out).toContain('at least 12 characters')
      untouched(log)
    },
  )

  it('refuses, with a warning, when free memory is short', async () => {
    fs.writeFileSync(h.p('meminfo'), 'MemAvailable: 500000 kB\n')
    const { code, out, log } = await h.install()
    expect(code).toBe(0)
    expect(out).toContain('::warning')
    expect(out).toContain('memory')
    expect(log).not.toContain(' up ')
  })

  it('does not check memory for Umami that is already running', async () => {
    write(h.p('umami/.env'), 'UMAMI_PORT=1\n')
    fs.writeFileSync(h.p('meminfo'), 'MemAvailable: 500000 kB\n')
    const { code } = await h.install({ STUB_RUNNING: '1' })
    expect(code).toBe(0)
  })
})

describe('install-umami.sh: install', () => {
  it('backs up, starts, replaces the default password, then opens the address through Caddy', async () => {
    const { code, out, log } = await h.install()
    expect(out).toContain('Umami is live at https://stats.sprechereast.com')
    expect(code).toBe(0)
    expect(log).toContain('backup.sh pre-deploy')
    expect(log).toContain(' up -d')
    expect(log).toContain(`-f ${h.p('umami/compose.yaml')}`)
    expect(h.state.admin).toBe(SECRET)
    expect(h.state.requests).toContain('POST /api/me/password')
    expect(out).toContain('default admin password was replaced')
    expect(out).toContain('rejects its default admin password')
    expect(log).toContain('reload')

    const block = h.route()
    expect(block).toContain('stats.sprechereast.com {')
    expect(block).toContain(`reverse_proxy 127.0.0.1:${h.port}`)
    expect(block).toContain(`import ${h.p('caddy/hsts.caddy')}`) // the one HSTS path, filled in
    expect(block).not.toMatch(/__UMAMI|__HSTS/)
    expect(h.caddyfile()).toContain(`import ${h.p('caddy/sprecher-east-umami.caddy')}`)
    expect(h.caddyfile()).toContain('reverse_proxy localhost:3000') // the site's own block is untouched
  })

  it('skips the second backup when this deploy already made one', async () => {
    const { code, log } = await h.install({ PRE_DEPLOY_BACKUP_DONE: 'yes' })
    expect(code).toBe(0)
    expect(log).not.toContain('backup.sh')
  })

  it('writes generated secrets to a root-only file and never prints a secret', async () => {
    const { out } = await h.install()
    const env = h.envFile()
    expect(env).toMatch(/^UMAMI_DB_PASSWORD=[0-9a-f]{64}$/m)
    expect(env).toMatch(/^UMAMI_APP_SECRET=[0-9a-f]{64}$/m)
    expect(env).toMatch(/^UMAMI_TWO_FACTOR_KEY=[0-9a-f]{64}$/m)
    expect(fs.statSync(h.p('umami/.env')).mode & 0o077).toBe(0)
    for (const secret of [SECRET, ...env.match(/[0-9a-f]{64}/g), 'fake-token']) {
      expect(out).not.toContain(secret)
    }
  })

  it('keeps its secrets, its Caddy line and the password on the next deploy', async () => {
    await h.install()
    const first = h.envFile()
    const { code, out, log } = await h.install({ STUB_RUNNING: '1', MEMINFO: '/nonexistent' })
    expect(code).toBe(0)
    expect(h.envFile()).toBe(first)
    expect(out).toContain('Umami updated')
    expect(out).toContain('already the one in the secret')
    expect(log).toContain('exec -T db') // the dump before an update
    expect(h.caddyfile().match(/import /g)).toHaveLength(1)
    expect(h.state.requests.filter((r) => r === 'POST /api/me/password')).toHaveLength(1)
  })

  it('leaves a password someone changed in Umami as it is, and still opens the address', async () => {
    h.state.admin = 'a-password-set-in-the-umami-ui'
    const { code, out } = await h.install()
    expect(code).toBe(0)
    expect(out).toContain('changed in Umami')
    expect(h.state.admin).toBe('a-password-set-in-the-umami-ui')
  })

  it('counts a login that asks for the two-factor code as the secret being right', async () => {
    h.state.admin = SECRET
    h.state.twoFactor = true
    const { code, out } = await h.install()
    expect(code).toBe(0)
    expect(out).toContain('already the one in the secret')
    expect(out).toContain('rejects its default admin password')
    expect(h.route()).toContain('reverse_proxy')
  })
})
