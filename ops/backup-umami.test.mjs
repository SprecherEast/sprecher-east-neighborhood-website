import fs from 'node:fs'
import zlib from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { setUpUmamiHarness, write } from './umami-harness.mjs'

const h = setUpUmamiHarness()
const installed = () => write(h.p('umami/.env'), 'UMAMI_PORT=1\nUMAMI_APP_SECRET=abc\n')
const dumps = (kind) =>
  fs
    .readdirSync(h.p('backups/umami'))
    .filter((f) => f.startsWith(`umami-${kind}-`) && f.endsWith('.sql.gz'))
const envs = (kind) =>
  fs
    .readdirSync(h.p('backups/umami'))
    .filter((f) => f.startsWith(`umami-${kind}-`) && f.endsWith('.env'))

describe('backup-umami.sh', () => {
  it('does nothing, successfully, while Umami is not installed', async () => {
    const { code, log } = await h.run('backup-umami.sh')
    expect(code).toBe(0)
    expect(log).not.toContain('exec')
    expect(fs.existsSync(h.p('backups'))).toBe(false)
  })

  it('warns and skips while the database is not running', async () => {
    installed()
    const { code, out, log } = await h.run('backup-umami.sh')
    expect(code).toBe(0)
    expect(out).toContain('::warning')
    expect(out).toContain('not running')
    expect(log).not.toContain('exec')
    expect(fs.existsSync(h.p('backups'))).toBe(false)
  })

  it('refuses an unknown kind', async () => {
    installed()
    expect((await h.run('backup-umami.sh', {}, ['weekly'])).code).toBe(2)
  })

  it('dumps the database and copies the settings, both root-only', async () => {
    installed()
    const { code, out } = await h.run('backup-umami.sh', { STUB_RUNNING: 'umami db' })
    expect(code).toBe(0)
    expect(out).toContain('database dump ok')
    const [dump] = dumps('daily')
    expect(zlib.gunzipSync(fs.readFileSync(h.p('backups/umami', dump))).toString()).toContain(
      '-- dump',
    )
    expect(envs('daily')).toHaveLength(1)
    expect(fs.readFileSync(h.p('backups/umami', envs('daily')[0]), 'utf8')).toContain(
      'UMAMI_APP_SECRET=abc',
    )
    for (const f of [dump, envs('daily')[0]])
      expect(fs.statSync(h.p('backups/umami', f)).mode & 0o077).toBe(0)
    expect(fs.statSync(h.p('backups/umami')).mode & 0o077).toBe(0)
    expect(fs.statSync(h.p('backups')).mode & 0o077).toBe(0)
  })

  it('leaves nothing behind when the dump fails', async () => {
    installed()
    const { code, out } = await h.run('backup-umami.sh', {
      STUB_RUNNING: 'umami db',
      STUB_DUMP_FAILS: '1',
    })
    expect(code).toBe(1)
    expect(out).toContain('::error')
    expect(fs.readdirSync(h.p('backups/umami'))).toEqual([])
  })

  it.each([
    ['daily', 7],
    ['pre-deploy', 5],
  ])('keeps the %s dumps to the newest %i, with their settings copies', async (kind, keep) => {
    installed()
    for (let i = 1; i <= 9; i++) {
      for (const ext of ['sql.gz', 'env'])
        write(h.p('backups/umami', `umami-${kind}-2000-01-0${i}T0000Z.${ext}`), 'old')
    }
    write(h.p('backups/umami/umami-other-2000-01-01T0000Z.sql.gz'), 'x')
    const { code } = await h.run('backup-umami.sh', { STUB_RUNNING: 'umami db' }, [kind])
    expect(code).toBe(0)
    expect(dumps(kind)).toHaveLength(keep)
    expect(envs(kind)).toHaveLength(keep)
    expect(dumps(kind)).not.toContain(`umami-${kind}-2000-01-01T0000Z.sql.gz`) // the oldest went
    expect(fs.existsSync(h.p('backups/umami/umami-other-2000-01-01T0000Z.sql.gz'))).toBe(true) // the other kind is not touched
  })
})
