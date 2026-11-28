import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sql } from '@payloadcms/db-sqlite'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { createLocalReq, type Payload } from 'payload'
import { vi } from 'vitest'

import { migrations } from '@/migrations'

import { bootPayload, createAccount } from './inMemoryPayload'
import { rawDb, sqlRows, type RawDb } from './sqlRows'

/**
 * A temporary SQLite database for a test that must see the database production has: built by the
 * repo's real migrations, in order, the way the deploy's `payload migrate` runs them, not by the
 * schema push every other test and `next dev` use (which gives every relationship the rule the
 * config says and so hides a migration that got a foreign key wrong). Also a schema-built twin to
 * compare it with. The file lives under the system temporary folder (`TMPDIR`) and `cleanup()`
 * removes it.
 */

export type Migration = (typeof migrations)[number]
type Step = Migration['up'] | Migration['down']

export type TestDatabase = {
  payload: Payload
  /** The SQLite file, for a test that copies it or opens it a second time. */
  file: string
  /** Runs one SQL statement and returns its rows (a `SELECT` or a `PRAGMA`). */
  query: <T = Record<string, unknown>>(statement: string) => Promise<T[]>
  /** Runs one migration step as `payload migrate` does: on the adapter's own connection, with no
   * wrapping transaction (the adapter starts none), so a migration that begins its own works.
   * `wrap` hands the step a stand-in for the connection, to inject a fault into it. */
  run: (step: Step, wrap?: (db: RawDb) => RawDb) => Promise<void>
  /** Closes Payload and removes the file. */
  cleanup: () => Promise<void>
}

async function open(kind: 'migrated' | 'schema'): Promise<TestDatabase> {
  const folder = mkdtempSync(path.join(tmpdir(), `${kind}-database-`))
  const file = path.join(folder, `${kind}.db`)
  // The config reads DATABASE_URI once, when it loads: load it again for this file
  vi.resetModules()
  // `getPayload` keeps the instance of an earlier database, even a destroyed one
  ;(globalThis as { _payload?: Map<string, unknown> })._payload?.clear()
  // Payload pushes the schema itself unless it believes it is in production
  if (kind === 'migrated') vi.stubEnv('NODE_ENV', 'production')
  const { payload } = await bootPayload(`file:${file}`)
  const query = async <T>(statement: string) => sqlRows<T>(payload, sql.raw(statement))
  const run = async (step: Step, wrap: (db: RawDb) => RawDb = (db) => db) => {
    const req = await createLocalReq({}, payload)
    await step({
      db: wrap(rawDb(payload)),
      payload,
      req,
    } as unknown as MigrateUpArgs & MigrateDownArgs)
  }
  return {
    payload,
    file,
    query,
    run,
    cleanup: async () => {
      await payload.destroy()
      rmSync(folder, { recursive: true, force: true })
    },
  }
}

/**
 * Every real migration's `up`, in order, on an empty file. Foreign keys are on, as in libsql.
 * `before` stops ahead of the migration of that name, so a test can fill the tables the way
 * production had them and then run that migration itself.
 */
export async function createMigratedDatabase(
  options: { before?: string } = {},
): Promise<TestDatabase> {
  const database = await open('migrated')
  for (const migration of migrations) {
    if (migration.name === options.before) break
    await database.run(migration.up)
  }
  return database
}

/** The same schema built from the config (Payload's push), as every other test and `next dev` get it. */
export async function createSchemaDatabase(): Promise<TestDatabase> {
  return open('schema')
}

/**
 * Runs `work` on a database that is behind the config: a migration that adds a collection comes
 * after the one under test, so the edit-lock query Payload makes on every update names a column
 * the database does not have yet. The missing `<collection>_id` columns of the edit-lock table
 * are added as plain columns for the work and dropped again, leaving the table as the migrations
 * made it.
 */
export async function withLaterColumns<T>(
  database: TestDatabase,
  work: () => Promise<T>,
): Promise<T> {
  const have = (
    await database.query<{ name: string }>(
      `SELECT name FROM pragma_table_info('payload_locked_documents_rels')`,
    )
  ).map((column) => column.name)
  const missing = database.payload.config.collections
    .map((collection) => `${collection.slug.replaceAll('-', '_')}_id`)
    .filter((column) => !have.includes(column))
  for (const column of missing) {
    await database.query(`ALTER TABLE payload_locked_documents_rels ADD "${column}" integer`)
  }
  try {
    return await work()
  } finally {
    for (const column of missing) {
      await database.query(`ALTER TABLE payload_locked_documents_rels DROP COLUMN "${column}"`)
    }
  }
}

export type ForeignKey = {
  table: string
  column: string
  references: string
  onDelete: string
  onUpdate: string
}

/** Every foreign key of every table, one row per column, sorted by table then column. */
export async function listForeignKeys(database: TestDatabase): Promise<ForeignKey[]> {
  return database.query<ForeignKey>(
    `SELECT m.name AS "table", f."from" AS "column", f."table" AS "references",
            f.on_delete AS onDelete, f.on_update AS onUpdate
       FROM sqlite_master m, pragma_foreign_key_list(m.name) f
      WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%'
      ORDER BY m.name, f."from"`,
  )
}

/** The SQL text of a raw query the migrations send, for a fault-injecting stand-in connection. */
export const statementOf = (query: Parameters<RawDb['run']>[0]) =>
  (query.queryChunks as { value: string[] }[]).map((chunk) => chunk.value.join('')).join('')

/**
 * A row written straight to a table, the way an older release left it: for a database that is
 * behind the config, where Payload's own writes would name a column or a table that comes later.
 * Each required column without a default that `values` leaves out gets a placeholder. Returns its id.
 */
export async function insertRawRow(
  database: TestDatabase,
  table: string,
  values: Record<string, string | number>,
): Promise<number> {
  const columns = await database.query<{
    name: string
    type: string
    notnull: number
    dflt_value: unknown
    pk: number
  }>(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`)
  const row: Record<string, string | number> = { ...values }
  for (const column of columns) {
    if (column.pk || column.name in row || !column.notnull || column.dflt_value !== null) continue
    row[column.name] = column.type.toLowerCase() === 'integer' ? 1 : 'x'
  }
  const names = Object.keys(row)
  const literal = (value: string | number) =>
    typeof value === 'number' ? String(value) : `'${value.replaceAll("'", "''")}'`
  const [created] = await database.query<{ id: number }>(
    `INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${names.map((name) => literal(row[name] as string | number)).join(', ')}) RETURNING id`,
  )
  return Number(created?.id)
}

/** A media row, written the way the database sees it: no file on disk. Returns its id. */
export async function createMedia(database: TestDatabase, alt: string): Promise<number> {
  const row = await database.payload.db.create({
    collection: 'media',
    data: { alt, filename: `${alt}.png`, mimeType: 'image/png' },
  })
  return row.id as number
}

const lockHolders = new WeakMap<TestDatabase, Awaited<ReturnType<typeof createAccount>>>()

/** An edit lock, as Payload writes it when an editor opens a document. Returns its row id. */
export async function lockDocument(
  database: TestDatabase,
  relationTo: string,
  value: number,
): Promise<number> {
  const { payload } = database
  let editor = lockHolders.get(database)
  if (!editor) {
    editor = await createAccount(payload, 'editor', 'lock-holder')
    lockHolders.set(database, editor)
  }
  const row = await payload.db.create({
    collection: 'payload-locked-documents',
    data: {
      document: { relationTo, value },
      globalSlug: null,
      user: { relationTo: 'users', value: editor.id },
    },
  })
  return row.id as number
}
