import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { down, up } from '@/migrations/20261126_203500_foreign_key_delete_rules'
import {
  createMigratedDatabase,
  createSchemaDatabase,
  listForeignKeys,
  type ForeignKey,
  type TestDatabase,
} from '@/platform/payload/testing/migratedDatabase'
import {
  seedLikeProduction,
  snapshot,
  type Snapshot,
} from '@/platform/payload/testing/productionLikeData'

/**
 * The delete-rules migration (#1559) on a database filled the way production had it before the
 * migration: it rebuilds posts, events, their versions and two link tables, and must lose nothing,
 * give back every index, default and rule, apply, roll back and apply again, and keep every row
 * out of the cascade of its own drop. Failures are in `deleteRulesGuards.test.ts`.
 */

const MIGRATION = '20261126_203500_foreign_key_delete_rules'
let database: TestDatabase
let schemaKeys: ForeignKey[]
let keysBefore: ForeignKey[]
let original: Snapshot

const rulesOf = async () => {
  const keys = await listForeignKeys(database)
  return keys.map((key) => `${key.table}.${key.column}:${key.onDelete}`)
}
// The config also holds what later migrations add (the OAuth tables, #1501), which this one
// stops short of: compare only the keys on the tables and columns the database has.
const rulesOfSchema = () =>
  schemaKeys
    .filter(
      (key) => !LATER.some((later) => key.table.startsWith(later) || key.column.startsWith(later)),
    )
    .map((key) => `${key.table}.${key.column}:${key.onDelete}`)
const LATER = ['oauth_']

beforeAll(async () => {
  const fromSchema = await createSchemaDatabase()
  schemaKeys = await listForeignKeys(fromSchema)
  await fromSchema.cleanup()
  database = await createMigratedDatabase({ before: MIGRATION })
  keysBefore = await listForeignKeys(database)
  await seedLikeProduction(database)
  original = await snapshot(database)
}, 180_000)

afterAll(async () => {
  await database?.cleanup()
})

describe('the seed', () => {
  it('has rows in every table the migration rebuilds', () => {
    for (const table of [
      'posts',
      '_posts_v',
      'events',
      '_events_v',
      'payload_locked_documents_rels',
      'payload_preferences_rels',
    ]) {
      expect(original.rows[table]?.length, table).toBeGreaterThan(0)
    }
    expect(original.rows._posts_v?.length).toBeGreaterThanOrEqual(3)
  })
})

describe('the migration', () => {
  it('starts with the 20 foreign keys without the schema’s rule', () => {
    const differing = keysBefore.filter(
      (key) => !rulesOfSchema().includes(`${key.table}.${key.column}:${key.onDelete}`),
    )
    expect(differing).toHaveLength(20)
  })

  it('up loses no row, keeps every index and column, gives the schema’s rules, and restores foreign keys', async () => {
    await database.run(up)
    expect(await snapshot(database)).toEqual(original)
    expect(await rulesOf()).toEqual(rulesOfSchema())
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    expect(await database.query('PRAGMA foreign_key_check')).toEqual([])
    expect(await database.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }])
  })

  it('down loses no row and puts the old rules back', async () => {
    await database.run(down)
    expect(await snapshot(database)).toEqual(original)
    expect(await listForeignKeys(database)).toEqual(keysBefore)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    expect(await database.query('PRAGMA foreign_key_check')).toEqual([])
  })

  it('up again gives the same result', async () => {
    await database.run(up)
    expect(await snapshot(database)).toEqual(original)
    expect(await rulesOf()).toEqual(rulesOfSchema())
  })

  it('keeps the versions and lock rows when it drops posts and events (no cascade)', async () => {
    const count = async (table: string) => (await database.query(`SELECT 1 FROM ${table}`)).length
    expect(await count('_posts_v')).toBe(original.rows._posts_v?.length)
    expect(await count('posts_rels')).toBe(original.rows.posts_rels?.length)
    expect(await count('payload_locked_documents_rels')).toBe(
      original.rows.payload_locked_documents_rels?.length,
    )
  })
})
