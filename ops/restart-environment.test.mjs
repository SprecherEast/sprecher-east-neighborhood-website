// restart-app.sh's check that Caddy reaches the app by loopback before it binds to 127.0.0.1
// (#118), for production and for a pull request preview (#1073): each reads its own Caddy block and
// its own port. The stored PM2 settings differ from the wanted ones, so the check runs.
import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PREVIEW_URL, PROD_URL, setUpEnvironmentHarness } from './environment-harness.mjs'

const { p, log, makeRelease, runScript } = setUpEnvironmentHarness()

const STORED = (name) =>
  JSON.stringify([{ name, pm2_env: { args: 'start', pm_cwd: '/somewhere/old' } }])

/** Runs restart-app.sh for production (3000) or preview 7 (3207) with `block` as its Caddy site. */
function restart({ preview = false, block }) {
  const root = preview ? p('previews/pr-7') : p('app')
  const release = `${root}/releases/r1`
  makeRelease(release, preview ? PREVIEW_URL : PROD_URL)
  fs.writeFileSync(p('state/jlist'), STORED(preview ? 'sprecher-east-pr-7' : 'sprecher-east'))
  fs.writeFileSync(p('state', preview ? 'sprecher-east-pr-7' : 'sprecher-east'), '')
  fs.writeFileSync(preview ? p('caddy/previews/pr-7.caddy') : p('caddy/Caddyfile'), block)
  // the other environment's file says the opposite, so reading the wrong one shows
  if (preview)
    fs.writeFileSync(p('caddy/Caddyfile'), 'x.test {\n\treverse_proxy 10.0.0.1:3207\n}\n')
  else
    fs.writeFileSync(p('caddy/previews/pr-7.caddy'), 'x.test {\n\treverse_proxy 10.0.0.1:3000\n}\n')
  return runScript(release, 'restart-app.sh', preview ? { PREVIEW_NUMBER: '7' } : {})
}
const site = (upstream) => `site.test {\n\treverse_proxy ${upstream}\n}\n`

describe.each([
  { name: 'production', preview: false, port: 3000, app: 'sprecher-east' },
  { name: 'a preview', preview: true, port: 3207, app: 'sprecher-east-pr-7' },
])('restart-app.sh for $name', ({ preview, port, app }) => {
  it.each([`localhost:${port}`, `127.0.0.1:${port}`])(
    'starts fresh with its new settings when Caddy proxies to %s',
    async (upstream) => {
      const { code, out } = await restart({ preview, block: site(upstream) })
      expect(code).toBe(0)
      expect(out).not.toContain('WARNING')
      expect(log()).toContain(`pm2 delete ${app}`)
      expect(log()).toContain(`pm2 start`)
    },
  )

  it('leaves the settings alone and warns when Caddy proxies to a non-loopback upstream', async () => {
    const { code, out } = await restart({ preview, block: site(`10.0.0.2:${port}`) })
    expect(code).toBe(0)
    expect(out).toContain(`WARNING: Caddy's upstreams for port ${port} (10.0.0.2:${port} )`)
    expect(log()).toContain(`pm2 reload ${app}`)
    expect(log()).not.toContain('pm2 delete')
  })

  it('warns when its own site block has no upstream on its port', async () => {
    const { out } = await restart({ preview, block: site('localhost:4999') })
    expect(out).toContain(`upstreams for port ${port} (none found)`)
    expect(log()).not.toContain('pm2 delete')
  })

  it('checks NEXT_PUBLIC_SERVER_URL against the app’s own port only where that is its address', async () => {
    const url = `http://localhost:${port}`
    fs.mkdirSync(p(preview ? 'previews/pr-7' : 'app'), { recursive: true })
    fs.writeFileSync(
      p(preview ? 'previews/pr-7/.env.local' : 'app/.env.local'),
      `NEXT_PUBLIC_SERVER_URL=${url}\n`,
    )
    const { out } = await restart({ preview, block: site(`localhost:${port}`) })
    if (preview) {
      // a preview's address is derived from its number, whatever its settings say
      expect(out).not.toContain('WARNING')
      expect(log()).toContain('pm2 delete')
    } else {
      expect(out).toContain(`NEXT_PUBLIC_SERVER_URL points at port ${port}`)
      expect(log()).not.toContain('pm2 delete')
    }
  })
})
