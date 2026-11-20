// deploy-release.sh for production (no environment named) and for one pull request preview
// (#1073), against the stubbed server tree of ./environment-harness.mjs.
import fs from 'node:fs'
import net from 'node:net'

import { describe, expect, it } from 'vitest'

import {
  HOUSEKEEPING,
  PREVIEW_URL,
  PROD_URL,
  TEST_SITE_KEY,
  setUpEnvironmentHarness,
} from './environment-harness.mjs'

const { p, log, makeRelease, runScript, deploy } = setUpEnvironmentHarness()

const production = () => {
  const release = p('app/releases/r1')
  makeRelease(release, PROD_URL)
  return deploy(release)
}
const preview = (env = {}, number = '7', built = TEST_SITE_KEY) => {
  const release = p(`previews/pr-${number}/releases/r1`)
  makeRelease(release, PREVIEW_URL, built)
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
    expect(fs.readFileSync(p('app/.env.local'), 'utf8')).toBe(
      `NEXT_PUBLIC_SERVER_URL=${PROD_URL}\n`,
    )
    expect(fs.existsSync(p('previews/pr-7/.env.local'))).toBe(false) // no preview settings are made
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

  it('makes the preview’s own settings first, keeps them on a redeploy, and prints no secret', async () => {
    const { out } = await preview()
    const settings = p('previews/pr-7/.env.local')
    const first = fs.readFileSync(settings, 'utf8')
    expect(out).toContain('preview 7 has its own settings file')
    for (const secret of first.match(/[0-9a-f]{64}/g)) expect(out).not.toContain(secret)
    await preview()
    expect(fs.readFileSync(settings, 'utf8')).toBe(first)
    expect(fs.readFileSync(p('app/.env.local'), 'utf8')).toBe(
      `NEXT_PUBLIC_SERVER_URL=${PROD_URL}\n`,
    )
  })

  it('runs the settings and restart scripts of the folder it runs from, never the release’s own (#1345)', async () => {
    // The restricted account runs main's copy of the scripts on a pull request's release.
    makeRelease(p('trusted'), PREVIEW_URL, TEST_SITE_KEY)
    const release = p('previews/pr-7/releases/r1')
    makeRelease(release, PREVIEW_URL, TEST_SITE_KEY)
    for (const f of ['preview-settings.sh', 'restart-app.sh'])
      fs.writeFileSync(`${release}/ops/${f}`, 'echo HOSTILE >> "$STUB_LOG"; exit 1\n')
    const { code, out } = await runScript(p('trusted'), 'deploy-release.sh', {
      CODE_DIR: release,
      PREVIEW_NUMBER: '7',
    })
    expect(code, out).toBe(0)
    expect(log()).not.toContain('HOSTILE')
    expect(fs.existsSync(p('previews/pr-7/.env.local'))).toBe(true) // main's settings script ran
    expect(log()).toContain('pm2 start')
  })

  it('still runs the settings gates against the preview’s own settings', async () => {
    const { code, out } = await preview({}, '7', '0x4AAAA') // built with a key the settings don’t hold
    expect(code).toBe(1)
    expect(out).toContain('Turnstile site key')
    expect(log()).not.toContain('pm2 start')
  })

  it('stops, changing nothing, when the kept settings are not a preview’s', async () => {
    fs.mkdirSync(p('previews/pr-7'), { recursive: true })
    fs.writeFileSync(p('previews/pr-7/.env.local'), 'SMTP_HOST=mail.example.test\n')
    const { code, out } = await preview()
    expect(code).toBe(1)
    expect(out).toContain("the preview's settings are not in order")
    expect(log()).not.toContain('pm2')
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
