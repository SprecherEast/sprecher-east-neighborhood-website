import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { sql } from '@payloadcms/db-sqlite'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { createLocalReq, type Payload } from 'payload'
import { vi } from 'vitest'

import { migrations } from '@/migrations'

import { bootPayload } from './inMemoryPayload'

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
type Rows<T> = { rows: T[] }
type Drizzle = { run: (query: ReturnType<typeof sql>) => Promise<unknown> }

export type TestDatabase = {
  payload: Payload
  /** The SQLite file, for a test that copies it or opens it a second time. */
  file: string
  /** Runs one SQL statement and returns its rows (a `SELECT` or a `PRAGMA`). */
  query: <T = Record<string, unknown>>(statement: string) => Promise<T[]>
  /** Runs one migration step as `payload migrate` does: on the adapter's own connection, with no
   * wrapping transaction (the adapter starts none), so a migration that begins its own works. */
  run: (step: Step) => Promise<void>
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
  const drizzle = payload.db.drizzle as unknown as Drizzle
  const query = async <T>(statement: string) =>
    ((await drizzle.run(sql.raw(statement))) as Rows<T>).rows
  const run = async (step: Step) => {
    const req = await createLocalReq({}, payload)
    await step({ db: drizzle, payload, req } as unknown as MigrateUpArgs & MigrateDownArgs)
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
