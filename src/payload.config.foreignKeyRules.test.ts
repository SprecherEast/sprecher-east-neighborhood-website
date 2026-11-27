import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createMigratedDatabase,
  createSchemaDatabase,
  listForeignKeys,
  type ForeignKey,
  type TestDatabase,
} from '@/platform/payload/testing/migratedDatabase'

/**
 * Every foreign key of a database built by the real migrations has the same delete rule as in one
 * built from the schema (#1559). A migration that adds a relationship column with a bare
 * `REFERENCES x(id)` gets NO ACTION, so deleting the row it points at fails in production while every
 * test, which builds the schema, passes. Add the column the way Payload's generated migrations do:
 * `REFERENCES x(id) ON UPDATE no action ON DELETE <the schema's rule>`.
 */

let migrated: ForeignKey[]
let schema: ForeignKey[]
let databases: TestDatabase[] = []

beforeAll(async () => {
  const fromSchema = await createSchemaDatabase()
  schema = await listForeignKeys(fromSchema)
  await fromSchema.cleanup()
  const fromMigrations = await createMigratedDatabase()
  databases = [fromMigrations]
  migrated = await listForeignKeys(fromMigrations)
}, 180_000)

afterAll(async () => {
  await Promise.all(databases.map((database) => database.cleanup()))
})

const describeKey = (key: ForeignKey) =>
  `${key.table}.${key.column} -> ${key.references}: ON DELETE ${key.onDelete}, ON UPDATE ${key.onUpdate}`

describe('foreign keys on a database built by the real migrations', () => {
  it('lists foreign keys at all', () => {
    expect(schema.length).toBeGreaterThan(100)
  })

  it('have the schema’s table, column, target and rules, and no other', () => {
    const inSchema = new Map(schema.map((key) => [`${key.table}.${key.column}`, key]))
    const inMigrations = new Map(migrated.map((key) => [`${key.table}.${key.column}`, key]))
    const differences = [
      ...[...inMigrations].flatMap(([name, key]) => {
        const wanted = inSchema.get(name)
        if (!wanted) return [`${name}: only in the migrated database (${describeKey(key)})`]
        return describeKey(wanted) === describeKey(key)
          ? []
          : [`${name}: migrated has ${describeKey(key)}, the schema has ${describeKey(wanted)}`]
      }),
      ...[...inSchema]
        .filter(([name]) => !inMigrations.has(name))
        .map(([name, key]) => `${name}: only in the schema (${describeKey(key)})`),
    ]
    expect(differences).toEqual([])
  })
})
