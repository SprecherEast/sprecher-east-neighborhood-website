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
 * runs in a transaction, as `payload migrate` runs it. What it adds to the edit-lock table is also
 * what the schema says: the same delete and update rule on the two new keys (the rule a plain
 * `ALTER TABLE … REFERENCES` leaves out is `ON DELETE`, which makes a delete that Payload does not
 * make itself fail, #1559).
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
/** The delete and update rule of the keys the migration adds to the edit-lock table */
const lockKeyRules = async () => {
  const result = (await drizzle().run(
    sql`SELECT "table", "from", on_update, on_delete FROM pragma_foreign_key_list('payload_locked_documents_rels') WHERE "from" IN ('oauth_clients_id', 'oauth_tokens_id') ORDER BY "from"`,
  )) as { rows: Record<string, string>[] }
  return result.rows.map((row) => ({
    table: row.table,
    from: row.from,
    onUpdate: row.on_update,
    onDelete: row.on_delete,
  }))
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
  const [clientDoc] = client.docs
  if (!clientDoc) throw new Error('The client was not found')
  const lockedId = clientDoc.id
  await payload.db.create({
    collection: 'payload-locked-documents',
    data: {
      document: { relationTo: 'oauth-clients' as const, value: lockedId },
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
    // The database was built from the schema: its rules are what the migration must reproduce
    const fromSchema = await lockKeyRules()
    expect(fromSchema).toEqual([
      {
        table: 'oauth_clients',
        from: 'oauth_clients_id',
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
      {
        table: 'oauth_tokens',
        from: 'oauth_tokens_id',
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },
    ])
    expect(created).toEqual(['oauth_clients', 'oauth_clients_redirect_uris', 'oauth_tokens'])
    await inTransaction(down)
    expect(await tables()).toEqual([])
    await inTransaction(up)
    expect(await tables()).toEqual(created)
    expect(await lockKeyRules()).toEqual(fromSchema)
  })
})
