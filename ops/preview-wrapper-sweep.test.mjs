// What the wrapper does for removing previews, listing strays and holding the cap and the disk floor (#1076).
// The restricted account's other actions are tested in preview-wrapper.test.mjs.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { COMMIT, setUpPreviewAccessHarness } from './preview-access-harness.mjs'

const { p, stub, log, wrapper } = setUpPreviewAccessHarness()

/** A real .tar.gz of one file of this many bytes (it compresses to almost nothing, and unpacks to all of them). */
const tarOf = (bytes) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-tar-'))
  fs.writeFileSync(path.join(dir, 'file'), Buffer.alloc(bytes, 'y'))
  const out = execFileSync('tar', ['-czf', '-', '-C', dir, '.'], { maxBuffer: 1 << 26 })
  fs.rmSync(dir, { recursive: true })
  return out
}
const GOOD = tarOf(100)
const pm2Listing = (processes) =>
  `echo "pm2 $*" >> "$STUB_LOG"; if [ "$1" = jlist ]; then echo '[PM2] noise'; echo '${JSON.stringify(
    processes,
  )}'; fi`
const online = (name) => ({ name, pm2_env: { status: 'online' } })

const makePreview = (n, { commit = COMMIT, ageSeconds = 0 } = {}) => {
  fs.mkdirSync(p(`previews/pr-${n}/releases/${commit}`), { recursive: true })
  fs.symlinkSync(`releases/${commit}`, p(`previews/pr-${n}/current`))
  if (ageSeconds) {
    const then = new Date(Date.now() - ageSeconds * 1000)
    fs.lutimesSync(p(`previews/pr-${n}/current`), then, then)
  }
}
const block = (n) => fs.writeFileSync(p(`caddy/previews/pr-${n}.caddy`), `# block ${n}\n`)

describe('list (#1076)', () => {
  it('shows a leftover with no folder: a block, or a PM2 process', async () => {
    block(5)
    stub('pm2', pm2Listing([online('sprecher-east-pr-9')]))
    const { code, out } = await wrapper('list')
    expect(code).toBe(0)
    expect(out.trim().split('\n')).toEqual([
      expect.stringMatching(/^preview=5 commit=none idle=\d+ folder=no block=yes process=none$/),
      expect.stringMatching(/^preview=9 commit=none idle=\d+ folder=no block=no process=online$/),
    ])
  })

  it('says for one preview what exists, and how long ago it was last deployed', async () => {
    makePreview(7, { ageSeconds: 3 * 86400 })
    block(7)
    stub('pm2', pm2Listing([{ name: 'sprecher-east-pr-7', pm2_env: { status: 'stopped' } }]))
    const { out } = await wrapper('list')
    const idle = Number(/idle=(\d+)/.exec(out)[1])
    expect(idle).toBeGreaterThanOrEqual(3 * 86400)
    expect(idle).toBeLessThan(3 * 86400 + 60)
    expect(out).toContain(`preview=7 commit=${COMMIT} `)
    expect(out).toContain('folder=yes block=yes process=stopped')
  })

  it('takes no name from PM2 that is not a preview’s, and none that is not a number', async () => {
    stub(
      'pm2',
      pm2Listing([
        online('sprecher-east'),
        online('sprecher-east-pr-'),
        online('sprecher-east-pr-07'),
        online('sprecher-east-pr-1; id'),
        online('sprecher-east-pr-../x'),
        online('umami'),
      ]),
    )
    const { code, out } = await wrapper('list')
    expect(code).toBe(0)
    expect(out).toBe('')
  })

  it('lists nothing, and does not fail, when PM2 prints nothing a parser can use', async () => {
    stub('pm2', 'echo "pm2 $*" >> "$STUB_LOG"; echo "not json"; exit 1')
    makePreview(7)
    const { code, out } = await wrapper('list')
    expect(code).toBe(0)
    expect(out).toMatch(/^preview=7 /)
  })

  it('does not read a block that is a link or a name that is not a number', async () => {
    fs.writeFileSync(p('victim.caddy'), 'x')
    fs.symlinkSync(p('victim.caddy'), p('caddy/previews/pr-4.caddy'))
    fs.writeFileSync(p('caddy/previews/pr-04.caddy'), 'x')
    fs.writeFileSync(p('caddy/previews/pr-x.caddy'), 'x')
    const { out } = await wrapper('list')
    expect(out).toBe('')
  })
})

describe('teardown (#1076)', () => {
  it('removes every item: the process, the folder (releases, data, media, settings) and the block', async () => {
    makePreview(7)
    for (const sub of ['data', 'public/media'])
      fs.mkdirSync(p(`previews/pr-7/${sub}`), { recursive: true })
    fs.writeFileSync(p('previews/pr-7/data/payload.db'), 'db')
    fs.writeFileSync(p('previews/pr-7/.env.local'), 'secret')
    block(7)
    block(8)
    const { code } = await wrapper('teardown 7')
    expect(code).toBe(0)
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
    expect(fs.existsSync(p('caddy/previews/pr-7.caddy'))).toBe(false)
    expect(fs.existsSync(p('caddy/previews/pr-8.caddy'))).toBe(true)
    expect(log()).toContain('pm2 delete sprecher-east-pr-7')
  })

  it('succeeds again when run twice, and when there is nothing to remove', async () => {
    makePreview(7)
    block(7)
    expect((await wrapper('teardown 7')).code).toBe(0)
    expect((await wrapper('teardown 7')).code).toBe(0)
    expect((await wrapper('teardown 8')).code).toBe(0)
  })

  it('removes a leftover that has a block and a process but no folder', async () => {
    block(5)
    const { code } = await wrapper('teardown 5')
    expect(code).toBe(0)
    expect(fs.existsSync(p('caddy/previews/pr-5.caddy'))).toBe(false)
    expect(log()).toContain('pm2 delete sprecher-east-pr-5')
  })

  it('never touches Caddy’s certificate storage', () => {
    const text = fs.readFileSync(new URL('./preview-wrapper.sh', import.meta.url), 'utf8')
    const caddy = fs.readFileSync(new URL('./preview-caddy.sh', import.meta.url), 'utf8')
    for (const script of [text, caddy])
      expect(script).not.toMatch(/CADDY_STORAGE_DIR|\/var\/lib\/caddy|\.local\/share\/caddy/)
  })
})

describe('the cap (#1076)', () => {
  it('refuses a new preview at the cap, with a fixed text, and leaves nothing behind', async () => {
    makePreview(1)
    const { code, out } = await wrapper(`upload 2 ${COMMIT}`, {
      input: GOOD,
      env: { PREVIEW_MAX_COUNT: '1' },
    })
    expect(code).toBe(2)
    expect(out).toContain('as many previews as are allowed')
    expect(fs.existsSync(p('previews/pr-2'))).toBe(false)
  })

  it('is one in production’s defaults until the server’s limits are measured, defined only in environment.sh', () => {
    const env = fs.readFileSync(new URL('./environment.sh', import.meta.url), 'utf8')
    expect(env).toContain('PREVIEW_MAX_COUNT="${PREVIEW_MAX_COUNT:-1}"')
    for (const file of [
      'preview-wrapper.sh',
      'preview-caddy.sh',
      '../.github/scripts/preview-deploy.sh',
    ]) {
      const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(text).not.toMatch(/PREVIEW_MAX_COUNT[:=]-?[0-9]/)
    }
  })

  it('lets only one of two previews that start together take the last place', async () => {
    const env = { PREVIEW_MAX_COUNT: '1' }
    const results = await Promise.all([
      wrapper(`upload 2 ${COMMIT}`, { input: GOOD, env }),
      wrapper(`upload 3 ${COMMIT}`, { input: GOOD, env }),
    ])
    expect(fs.readdirSync(p('previews')).filter((n) => n.startsWith('pr-'))).toHaveLength(1)
    expect(results.map((r) => r.code).sort()).toEqual([0, 2])
  })
})

describe('the disk floor (#1076)', () => {
  const kb = (n) => String(n)

  it('refuses a new preview before reading it when even the largest archive would go below the floor', async () => {
    const { code, out } = await wrapper(`upload 7 ${COMMIT}`, {
      input: GOOD,
      env: { PREVIEW_FREE_FLOOR_KB: kb(2 ** 33) },
    })
    expect(code).toBe(2)
    expect(out).toContain('not enough free disk')
    expect(fs.existsSync(p('previews/pr-7'))).toBe(false)
  })

  it('refuses a redeploy too, and keeps the release that is live', async () => {
    makePreview(7)
    const { code, out } = await wrapper(`upload 7 ${'b'.repeat(40)}`, {
      input: GOOD,
      env: { PREVIEW_FREE_FLOOR_KB: kb(2 ** 33) },
    })
    expect(code).toBe(2)
    expect(out).toContain('not enough free disk')
    expect(fs.existsSync(p(`previews/pr-7/releases/${COMMIT}`))).toBe(true)
    expect(fs.readlinkSync(p('previews/pr-7/current'))).toBe(`releases/${COMMIT}`)
  })

  it('counts what the archive unpacks to as well: free space that fits the largest archive but not this release', async () => {
    // 3000 KiB free, a floor of 1000 KiB, archives of up to 1 MiB: the check before reading passes
    stub(
      'df',
      'printf "Filesystem 1024-blocks Used Available Capacity Mounted\\nx 0 0 %s 0%% /\\n" "$STUB_FREE_KB"',
    )
    const env = {
      STUB_FREE_KB: '3000',
      PREVIEW_FREE_FLOOR_KB: '1000',
      PREVIEW_UPLOAD_MAX_BYTES: '1048576',
    }
    const fits = await wrapper(`upload 7 ${COMMIT}`, { input: tarOf(1_000_000), env })
    expect(fits.code, fits.out).toBe(0) // 1000 KiB unpacked: 2000 KiB free afterwards
    const over = await wrapper(`upload 8 ${COMMIT}`, { input: tarOf(2_100_000), env })
    expect(over.code).toBe(2)
    expect(over.out).toContain('not enough free disk')
    expect(fs.existsSync(p('previews/pr-8'))).toBe(false)
  })

  it('is the floor the production deploy’s preflight checks, as one number', () => {
    const env = fs.readFileSync(new URL('./environment.sh', import.meta.url), 'utf8')
    const deploy = fs.readFileSync(
      new URL('../.github/workflows/deploy.yml', import.meta.url),
      'utf8',
    )
    const floor = /PREVIEW_FREE_FLOOR_KB="\$\{PREVIEW_FREE_FLOOR_KB:-(\d+)\}"/.exec(env)[1]
    expect(deploy).toContain(`-gt ${floor} ]`)
  })
})
