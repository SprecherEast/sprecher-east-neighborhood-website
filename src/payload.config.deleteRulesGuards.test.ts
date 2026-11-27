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

  // `PRAGMA integrity_check` is not tested: it fails only on a corrupted database file, which no
  // statement a test can send produces, and the migration's other checks do not depend on it.
})
