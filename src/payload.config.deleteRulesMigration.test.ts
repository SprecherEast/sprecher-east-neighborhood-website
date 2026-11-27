import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { down, up } from '@/migrations/20261126_203500_foreign_key_delete_rules'
import { createAccount, paragraph } from '@/platform/payload/testing/inMemoryPayload'
import {
  createMigratedDatabase,
  createSchemaDatabase,
  listForeignKeys,
  type ForeignKey,
  type TestDatabase,
} from '@/platform/payload/testing/migratedDatabase'

/**
 * The delete-rules migration (#1559) on a database filled the way production had it before the
 * migration: it rebuilds posts, events, their versions and two link tables, and must lose nothing,
 * give back every index, default and rule, apply, roll back and apply again, and leave the database
 * as it was when it fails halfway.
 */

const MIGRATION = '20261126_203500_foreign_key_delete_rules'
const ctx = { disableRevalidate: true }
let database: TestDatabase
let schemaKeys: ForeignKey[]
let keysBefore: ForeignKey[]
let original: Snapshot

type Snapshot = { rows: Record<string, unknown[]>; shape: Record<string, unknown> }

/** Every row of every table, in id order, and every table's columns and indexes. */
async function snapshot(): Promise<Snapshot> {
  const tables = (
    await database.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
  ).map((table) => table.name)
  const rows: Snapshot['rows'] = {}
  const shape: Snapshot['shape'] = {}
  for (const table of tables) {
    rows[table] = await database.query(`SELECT * FROM "${table}" ORDER BY rowid`)
    shape[table] = {
      columns: await database.query(`SELECT * FROM pragma_table_info('${table}')`),
      indexes: await database.query(
        `SELECT name, sql FROM sqlite_master WHERE type IN ('index','trigger') AND tbl_name='${table}' AND sql IS NOT NULL ORDER BY name`,
      ),
    }
  }
  const { payload_migrations: _skip, ...rest } = rows
  return { rows: rest, shape }
}

const rulesOf = async () => {
  const keys = await listForeignKeys(database)
  return keys.map((key) => `${key.table}.${key.column}:${key.onDelete}`)
}
const rulesOfSchema = () => schemaKeys.map((key) => `${key.table}.${key.column}:${key.onDelete}`)

const media = async (alt: string) =>
  (
    await database.payload.db.create({
      collection: 'media',
      data: { alt, filename: `${alt}.png`, mimeType: 'image/png' },
    })
  ).id as number

beforeAll(async () => {
  const fromSchema = await createSchemaDatabase()
  schemaKeys = await listForeignKeys(fromSchema)
  await fromSchema.cleanup()
  database = await createMigratedDatabase({ before: MIGRATION })
  keysBefore = await listForeignKeys(database)
  const { payload } = database

  const editor = await createAccount(payload, 'editor', 'seed-editor')
  const [phone, tablet, desktop] = [await media('p'), await media('t'), await media('d')]
  const post = await payload.create({
    collection: 'posts',
    context: ctx,
    data: {
      title: 'Spring walk',
      slug: 'spring-walk',
      content: paragraph('Join us.'),
      backdrop: { phone, tablet, desktop },
      _status: 'published',
    },
  })
  // Two more versions, one with a changed title
  for (const title of ['Spring walk 2', 'Spring walk 3']) {
    await payload.update({
      collection: 'posts',
      id: post.id,
      context: ctx,
      data: { title, _status: 'published' },
    })
  }
  const event = await payload.create({
    collection: 'events',
    context: ctx,
    data: {
      title: 'Picnic',
      slug: 'picnic',
      date: '2027-06-01T00:00:00.000Z',
      backdrop: { phone, desktop },
      _status: 'published',
    },
  })
  await payload.update({
    collection: 'events',
    id: event.id,
    context: ctx,
    data: { title: 'Picnic 2', _status: 'published' },
  })
  await payload.create({
    collection: 'pages',
    context: ctx,
    data: {
      title: 'About',
      slug: 'about',
      hero: { type: 'none' },
      layout: [{ blockType: 'cta' }],
      _status: 'published',
    },
  })
  const confirmation = await payload.db.create({
    collection: 'email-confirmations',
    data: { email: 'seed@example.com' },
  })
  const agent = await createAccount(payload, 'agent', 'seed-agent')
  const key = await payload.db.create({
    collection: 'payload-mcp-api-keys',
    data: { user: agent.id, label: 'Agent', enableAPIKey: false },
  })
  const lock = (relationTo: string, value: number) =>
    payload.db.create({
      collection: 'payload-locked-documents',
      data: {
        document: { relationTo, value },
        globalSlug: null,
        user: { relationTo: 'users', value: editor.id },
      },
    })
  await lock('posts', post.id as number)
  await lock('events', event.id as number)
  await lock('email-confirmations', confirmation.id as number)
  await lock('payload-mcp-api-keys', key.id as number)
  await payload.db.create({
    collection: 'payload-preferences',
    data: { key: 'nav', user: { relationTo: 'users', value: editor.id }, value: { open: true } },
  })
  await payload.db.create({
    collection: 'payload-preferences',
    data: {
      key: 'nav',
      user: { relationTo: 'payload-mcp-api-keys', value: key.id },
      value: { a: 1 },
    },
  })
  original = await snapshot()
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
    expect(await snapshot()).toEqual(original)
    expect(await rulesOf()).toEqual(rulesOfSchema())
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    expect(await database.query('PRAGMA foreign_key_check')).toEqual([])
    expect(await database.query('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }])
  })

  it('down loses no row and puts the old rules back', async () => {
    await database.run(down)
    expect(await snapshot()).toEqual(original)
    expect(await listForeignKeys(database)).toEqual(keysBefore)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    expect(await database.query('PRAGMA foreign_key_check')).toEqual([])
  })

  it('up again gives the same result', async () => {
    await database.run(up)
    expect(await snapshot()).toEqual(original)
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

describe('a migration that fails halfway', () => {
  it('rolls back every table it rebuilt and switches foreign keys back on', async () => {
    await database.run(down)
    const before = await snapshot()
    // The third table's copy cannot be created, after the first two were rebuilt
    await database.query('CREATE TABLE `__new_events` (id integer)')
    const withBlocker = await snapshot()

    await expect(database.run(up)).rejects.toThrow()

    expect(await snapshot()).toEqual(withBlocker)
    expect(await listForeignKeys(database)).toEqual(keysBefore)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    expect(before.rows).toEqual(original.rows)
    // The tables the failed run rebuilt first are the old ones
    await database.query('DROP TABLE `__new_events`')
    expect(await snapshot()).toEqual(before)
  })

  it('refuses to run inside a transaction, where foreign keys cannot be switched off', async () => {
    await database.run(down)
    const before = await snapshot()
    await database.query('BEGIN')

    await expect(database.run(up)).rejects.toThrow(/could not be switched off/)

    await database.query('ROLLBACK')
    expect(await snapshot()).toEqual(before)
    expect(await listForeignKeys(database)).toEqual(keysBefore)
  })

  it('refuses a table that has a column it does not know, changing nothing', async () => {
    await database.run(down)
    await database.query('ALTER TABLE posts ADD `unexpected` text')
    const before = await snapshot()

    await expect(database.run(up)).rejects.toThrow(/Table posts is not as this migration expects/)

    expect(await snapshot()).toEqual(before)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    await database.query('ALTER TABLE posts DROP COLUMN `unexpected`')
  })
})
