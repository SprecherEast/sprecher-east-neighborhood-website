import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { migrations } from '@/migrations'
import { down, up } from '@/migrations/20261128_023421_client_scopes'
import {
  createMigratedDatabase,
  insertRawRow,
  type TestDatabase,
} from '@/platform/payload/testing/migratedDatabase'

/**
 * The client scopes migration (#1499), run the way production runs it: every migration before it
 * in order on an empty SQLite file (`createMigratedDatabase`, foreign keys on as in libsql), then
 * rows an earlier release left behind, then this one. Keys and clients that exist before it keep
 * working: a key gets both scopes, a client read only.
 */

const MIGRATION = '20261128_023421_client_scopes'
let database: TestDatabase
const insertRow = (table: string, values: Record<string, string | number>) =>
  insertRawRow(database, table, values)

let keyId: number
let clientId: number

beforeAll(async () => {
  database = await createMigratedDatabase({ before: MIGRATION })
  const agent = await insertRow('users', { email: 'scout@example.com', role: 'agent' })
  keyId = await insertRow('payload_mcp_api_keys', { user_id: agent, label: 'Local Scout' })
  clientId = await insertRow('oauth_clients', {
    name: 'Claude',
    client_id: 'mcp_old',
    agent_id: agent,
  })
  await database.run(up)
}, 180_000)

afterAll(async () => {
  await database?.cleanup()
})

const scopesOf = async (table: string, parent: number) =>
  (
    await database.query(`SELECT value FROM ${table} WHERE parent_id = ${parent} ORDER BY "order"`)
  ).map((row) => row.value)

describe('on a database built by the real migrations', () => {
  it('is the last migration, so this test covers what ships', () => {
    expect(migrations.at(-1)?.name).toBe(MIGRATION)
  })

  it('keeps a key that existed before: both scopes, no expiry', async () => {
    expect(await scopesOf('payload_mcp_api_keys_scopes', keyId)).toEqual(['read', 'suggest'])
    const [key] = await database.query(
      `SELECT expires_at FROM payload_mcp_api_keys WHERE id = ${keyId}`,
    )
    expect(key?.expires_at).toBeNull()
  })

  it('gives a client that existed before read only', async () => {
    expect(await scopesOf('oauth_clients_scopes', clientId)).toEqual(['read'])
  })

  it('gives each scopes table a foreign key that deletes with its parent', async () => {
    for (const [table, parent] of [
      ['payload_mcp_api_keys_scopes', 'payload_mcp_api_keys'],
      ['oauth_clients_scopes', 'oauth_clients'],
    ] as const) {
      const keys = await database.query(`PRAGMA foreign_key_list(${table})`)
      expect(keys).toEqual([
        expect.objectContaining({ from: 'parent_id', table: parent, on_delete: 'CASCADE' }),
      ])
    }
  })

  it('deletes a key or a client with its scopes, nothing left behind', async () => {
    const agent = await insertRow('users', { email: 'other@example.com', role: 'agent' })
    const key = await insertRow('payload_mcp_api_keys', { user_id: agent, label: 'Other' })
    await database.query(
      `INSERT INTO payload_mcp_api_keys_scopes ("order", parent_id, value) VALUES (1, ${key}, 'read')`,
    )
    await database.query(`DELETE FROM payload_mcp_api_keys WHERE id = ${key}`)
    expect(await scopesOf('payload_mcp_api_keys_scopes', key)).toEqual([])
    const client = await insertRow('oauth_clients', {
      name: 'T',
      client_id: 'mcp_t',
      agent_id: agent,
    })
    await database.query(
      `INSERT INTO oauth_clients_scopes ("order", parent_id, value) VALUES (1, ${client}, 'read')`,
    )
    await database.query(`DELETE FROM oauth_clients WHERE id = ${client}`)
    expect(await scopesOf('oauth_clients_scopes', client)).toEqual([])
  })

  it('reads through Payload as the scopes an admin sees in Admin', async () => {
    const key = await database.payload.findByID({
      collection: 'payload-mcp-api-keys',
      id: keyId,
      depth: 0,
      overrideAccess: true,
    })
    expect(key.scopes).toEqual(['read', 'suggest'])
    const client = await database.payload.findByID({
      collection: 'oauth-clients',
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })
    expect(client.scopes).toEqual(['read'])
  })
})

describe('rolling the migration back and applying it again', () => {
  it('removes the tables and columns, then gives the same scopes back', async () => {
    await database.run(down)
    const tables = await database.query(`SELECT name FROM sqlite_master WHERE name LIKE '%_scopes'`)
    expect(tables).toEqual([])
    const columns = await database.query('PRAGMA table_info(oauth_clients)')
    expect(columns.map((c) => c.name)).not.toContain('expires_at')
    await database.run(up)
    expect(await scopesOf('payload_mcp_api_keys_scopes', keyId)).toEqual(['read', 'suggest'])
    expect(await scopesOf('oauth_clients_scopes', clientId)).toEqual(['read'])
  })
})
