import { createClient } from '@libsql/client'
import { sql } from '@payloadcms/db-sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { down, up } from '@/migrations/20261126_203500_foreign_key_delete_rules'
import {
  createMigratedDatabase,
  listForeignKeys,
  statementOf,
  type ForeignKey,
  type TestDatabase,
} from '@/platform/payload/testing/migratedDatabase'
import {
  seedLikeProduction,
  snapshot as takeSnapshot,
  type Snapshot,
} from '@/platform/payload/testing/productionLikeData'
import type { RawDb } from '@/platform/payload/testing/sqlRows'

/**
 * What the delete-rules migration (#1559) does when something is wrong, on a database filled the
 * way production had it: it fails halfway, runs inside a transaction, meets a table it does not
 * know (a column, an index, a trigger), a rebuilt table that lost a row, or a rebuild that leaves a
 * broken foreign key. Each time it throws and the database stays as it was.
 */

const MIGRATION = '20261126_203500_foreign_key_delete_rules'
let database: TestDatabase
let keysBefore: ForeignKey[]
let original: Snapshot
const snapshot = () => takeSnapshot(database)

beforeAll(async () => {
  database = await createMigratedDatabase({ before: MIGRATION })
  keysBefore = await listForeignKeys(database)
  await seedLikeProduction(database)
  original = await snapshot()
}, 180_000)

afterAll(async () => {
  await database?.cleanup()
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
  it('refuses a table whose index has another definition than the one it knows, changing nothing', async () => {
    await database.run(down)
    await database.query('DROP INDEX `posts_slug_idx`')
    await database.query('CREATE INDEX `posts_slug_idx` ON `posts` (`title`)')
    const before = await snapshot()

    await expect(database.run(up)).rejects.toThrow(/Table posts is not as this migration expects/)

    expect(await snapshot()).toEqual(before)
    await database.query('DROP INDEX `posts_slug_idx`')
    await database.query('CREATE UNIQUE INDEX `posts_slug_idx` ON `posts` (`slug`)')
  })

  it('refuses a table that has a trigger, changing nothing', async () => {
    await database.run(down)
    await database.query('CREATE TRIGGER keep_me AFTER INSERT ON posts BEGIN SELECT 1; END')
    const before = await snapshot()

    await expect(database.run(up)).rejects.toThrow(/Table posts is not as this migration expects/)

    expect(await snapshot()).toEqual(before)
    await database.query('DROP TRIGGER keep_me')
  })

  /** A connection that, right after a statement starting with `prefix`, runs `fault` as well. */
  const faultAfter =
    (prefix: string, fault: string) =>
    (db: RawDb): RawDb => ({
      run: async (query) => {
        const result = await db.run(query)
        if (statementOf(query).startsWith(prefix)) await db.run(sql.raw(fault))
        return result
      },
    })

  it('rolls back when a rebuilt table lost a row', async () => {
    await database.run(down)
    const before = await snapshot()
    const loseRow = faultAfter(
      'INSERT INTO `__new_events`',
      'DELETE FROM `__new_events` WHERE rowid = (SELECT min(rowid) FROM `__new_events`)',
    )

    await expect(database.run(up, loseRow)).rejects.toThrow(/Rows changed/)

    expect(await snapshot()).toEqual(before)
    expect(await listForeignKeys(database)).toEqual(keysBefore)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
  })

  it('rolls back when the rebuild leaves a broken foreign key behind', async () => {
    await database.run(down)
    const before = await snapshot()
    // A row pointing at a post that does not exist, written while enforcement is off
    const orphan = faultAfter(
      'INSERT INTO `__new_posts`',
      "INSERT INTO posts_rels (parent_id, path) VALUES (987654, 'orphan')",
    )

    await expect(database.run(up, orphan)).rejects.toThrow(/foreign_key_check found/)

    expect(await snapshot()).toEqual(before)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
  })

  /**
   * Rebuilds `payload_preferences_rels`, a table nothing points at, with one change in its
   * definition, keeping its rows and indexes. Returns what puts the table back as it was.
   */
  const rebuildWithChange = async (from: string, to: string) => {
    const table = 'payload_preferences_rels'
    const objects = await database.query<{ type: string; sql: string }>(
      `SELECT type, sql FROM sqlite_master WHERE tbl_name = '${table}' AND sql IS NOT NULL ORDER BY type DESC`,
    )
    const definition = objects.find((object) => object.type === 'table')?.sql ?? ''
    const indexes = objects.filter((object) => object.type === 'index').map((object) => object.sql)
    const rebuild = async (create: string) => {
      await database.query(`CREATE TABLE \`__keep\` AS SELECT * FROM \`${table}\``)
      await database.query(`DROP TABLE \`${table}\``)
      await database.query(create)
      await database.query(`INSERT INTO \`${table}\` SELECT * FROM \`__keep\``)
      await database.query('DROP TABLE `__keep`')
      for (const index of indexes) await database.query(index)
    }
    expect(definition).toContain(from)
    await rebuild(definition.replace(from, to))
    return () => rebuild(definition)
  }

  it.each([
    ['a column of another type', '`path` text NOT NULL', '`path` varchar NOT NULL'],
    ['a column that lost NOT NULL', '`path` text NOT NULL', '`path` text'],
    [
      'a primary key that is no longer one',
      '`id` integer PRIMARY KEY NOT NULL',
      '`id` integer NOT NULL',
    ],
  ])('refuses a table with %s, changing nothing', async (_name, from, to) => {
    await database.run(down)
    const restore = await rebuildWithChange(from, to)
    const before = await snapshot()

    await expect(database.run(up)).rejects.toThrow(
      /Table payload_preferences_rels is not as this migration expects/,
    )

    expect(await snapshot()).toEqual(before)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    await restore()
  })

  it('rolls back when the database fails its integrity check', async () => {
    await database.run(down)
    // A second connection changes an unrelated index's stored text behind the adapter's back, so
    // the index no longer matches its table: nothing the migration rebuilds, and no other check
    // of it, sees that, but `PRAGMA integrity_check` does
    const original = (
      await database.query<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE name = 'users_email_idx'",
      )
    )[0].sql
    const rewrite = async (statement: string) => {
      const other = createClient({ url: `file:${database.file}` })
      try {
        await other.execute('PRAGMA writable_schema=ON')
        await other.execute({
          sql: "UPDATE sqlite_master SET sql = ? WHERE name = 'users_email_idx'",
          args: [statement],
        })
        const version = (await other.execute('PRAGMA schema_version')).rows[0][0] as number
        await other.execute(`PRAGMA schema_version=${version + 1}`)
        await other.execute('PRAGMA writable_schema=OFF')
      } finally {
        other.close()
      }
    }
    await rewrite(original.replace('(`email`)', '(`name`)'))
    const before = await snapshot()

    await expect(database.run(up)).rejects.toThrow(/integrity_check failed/)

    expect(await snapshot()).toEqual(before)
    expect(await database.query('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }])
    await rewrite(original)
  })
})
