import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import * as foreignKeyRules from '@/migrations/20261126_203500_foreign_key_delete_rules'
import * as oauthSignIn from '@/migrations/20261127_130000_mcp_oauth_sign_in'
import { createAccount } from '@/platform/payload/testing/inMemoryPayload'
import {
  createMigratedDatabase,
  createSchemaDatabase,
  listForeignKeys,
  lockDocument,
  type TestDatabase,
} from '@/platform/payload/testing/migratedDatabase'

import { registerClient, signIn } from '../../testing/oauthFlow'

/**
 * The OAuth sign-in migration (#1501) on a database the real migrations built, the way the deploy
 * has it: after the delete-rules migration (#1559), which is in `main` first. It applies, with
 * the same delete and update rule on its two new edit-lock keys as the schema gives them; it
 * rolls back with a client, tokens and an edit lock pointing at its tables, and leaves the
 * edit-lock table exactly as the delete-rules migration left it (column order, keys with their
 * rules, indexes), so that migration can still be rolled back, and both apply again.
 */

const MIGRATION = '20261127_130000_mcp_oauth_sign_in'
const LOCKS = 'payload_locked_documents_rels'
let database: TestDatabase
let schemaRules: string[]

const oauthTables = async () =>
  (
    await database.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'oauth_%' ORDER BY name`,
    )
  ).map((row) => row.name)

/** The edit-lock table as the next migration would check it: text, columns, keys, indexes. */
const lockTable = async () => ({
  sql: await database.query(`SELECT sql FROM sqlite_master WHERE name = '${LOCKS}'`),
  columns: await database.query(
    `SELECT name, type, "notnull", pk FROM pragma_table_info('${LOCKS}')`,
  ),
  keys: await database.query(`SELECT * FROM pragma_foreign_key_list('${LOCKS}') ORDER BY id`),
  indexes: await database.query(
    `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = '${LOCKS}' ORDER BY name`,
  ),
})

const newKeyRules = async () =>
  (await listForeignKeys(database))
    .filter((key) => key.table === LOCKS && key.column.startsWith('oauth_'))
    .map((key) => `${key.column}:${key.references}:${key.onDelete}:${key.onUpdate}`)

beforeAll(async () => {
  const fromSchema = await createSchemaDatabase()
  schemaRules = (await listForeignKeys(fromSchema))
    .filter((key) => key.table === LOCKS && key.column.startsWith('oauth_'))
    .map((key) => `${key.column}:${key.references}:${key.onDelete}:${key.onUpdate}`)
  await fromSchema.cleanup()
  database = await createMigratedDatabase({ before: MIGRATION })
}, 180_000)

afterAll(async () => {
  await database?.cleanup()
})

describe('the OAuth sign-in migration', () => {
  let before: Awaited<ReturnType<typeof lockTable>>

  it('applies after the delete-rules migration, with the rules the schema gives', async () => {
    before = await lockTable()
    await database.run(oauthSignIn.up)
    expect(await oauthTables()).toEqual([
      'oauth_clients',
      'oauth_clients_redirect_uris',
      'oauth_tokens',
    ])
    expect(schemaRules).toEqual([
      'oauth_clients_id:oauth_clients:CASCADE:NO ACTION',
      'oauth_tokens_id:oauth_tokens:CASCADE:NO ACTION',
    ])
    expect(await newKeyRules()).toEqual(schemaRules)
  })

  it('rolls back with a client, tokens and an edit lock in place, leaving the edit-lock table as it was', async () => {
    const { payload } = database
    const admin = await createAccount(payload, 'admin', 'ana')
    const agent = await createAccount(payload, 'agent', 'scout')
    const clientId = await registerClient(payload, admin, agent)
    await signIn(payload, admin, clientId)
    const { docs } = await payload.find({ collection: 'oauth-clients', overrideAccess: true })
    const client = docs[0]
    if (!client) throw new Error('The client was not found')
    const oauthLock = await lockDocument(database, 'oauth-clients', client.id)
    const unrelatedLock = await lockDocument(database, 'users', admin.id)

    await database.run(oauthSignIn.down)

    expect(await oauthTables()).toEqual([])
    // The edit lock on a client goes with it, rows and rel rows; a lock on anything else stays
    const locks = await database.query<{ id: number }>('SELECT id FROM payload_locked_documents')
    expect(locks.map((lock) => lock.id)).toEqual([unrelatedLock])
    expect(await database.query(`SELECT 1 FROM ${LOCKS} WHERE parent_id = ${oauthLock}`)).toEqual(
      [],
    )
    expect(await lockTable()).toEqual(before)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    expect(await database.query('PRAGMA foreign_key_check')).toEqual([])
  })

  it('leaves the delete-rules migration able to roll back, through its own table check, and apply again', async () => {
    await database.run(foreignKeyRules.down)
    await database.run(foreignKeyRules.up)
    expect(await lockTable()).toEqual(before)
    await database.run(oauthSignIn.up)
    expect(await newKeyRules()).toEqual(schemaRules)
  })
})
