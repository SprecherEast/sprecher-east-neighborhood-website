import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { sql } from '@payloadcms/db-sqlite'
import { createLocalReq, type Payload } from 'payload'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { down, up } from '@/migrations/20261126_170510_mcp_oauth_sign_in'

/**
 * The OAuth sign-in migration (#1501) rolls back on SQLite with foreign keys enforced, even with
 * clients, tokens and an edit lock pointing at its tables, and applies again afterwards. Each step
 * runs in a transaction, as `payload migrate` runs it.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
// A file, not memory: each transaction below needs the same database (see `bootPayload`)
const folder = mkdtempSync(path.join(tmpdir(), 'oauth-migration-'))
type Db = { run: (query: ReturnType<typeof sql>) => Promise<unknown> }
type Drizzle = Db & { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> }

const drizzle = () => payload.db.drizzle as unknown as Drizzle
const tables = async (): Promise<string[]> => {
  const result = (await drizzle().run(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'oauth_%'`,
  )) as { rows: { name: string }[] }
  return result.rows.map((row) => row.name).sort()
}
const inTransaction = async (step: typeof up | typeof down) => {
  const req = await createLocalReq({}, payload)
  await drizzle().transaction((tx) =>
    step({ db: tx, payload, req } as unknown as MigrateUpArgs & MigrateDownArgs),
  )
}

beforeAll(async () => {
  const { bootPayload } = await import('@/platform/payload/testing/inMemoryPayload')
  const booted = await bootPayload(`file:${path.join(folder, 'test.db')}`)
  payload = booted.payload
  await drizzle().run(sql`PRAGMA foreign_keys = ON`)
  const { createAccount } = await import('@/platform/payload/testing/inMemoryPayload')
  const admin = await createAccount(payload, 'admin', 'ana')
  const agent = await createAccount(payload, 'agent', 'scout')
  const { registerClient, signIn } = await import('../../testing/oauthFlow')
  const clientId = await registerClient(payload, admin, agent)
  await signIn(payload, admin, clientId)
  const client = await payload.find({ collection: 'oauth-clients', overrideAccess: true })
  await payload.db.create({
    collection: 'payload-locked-documents',
    data: {
      document: { relationTo: 'oauth-clients' as const, value: client.docs[0]!.id },
      user: { relationTo: 'users', value: admin.id },
    },
  })
}, 60_000)

afterAll(async () => {
  await payload.destroy()
  rmSync(folder, { recursive: true, force: true })
})

describe('the OAuth sign-in migration', () => {
  it('rolls back with references in place, then applies again', async () => {
    const created = await tables()
    expect(created).toEqual(['oauth_clients', 'oauth_clients_redirect_uris', 'oauth_tokens'])
    await inTransaction(down)
    expect(await tables()).toEqual([])
    await inTransaction(up)
    expect(await tables()).toEqual(created)
  })
})
