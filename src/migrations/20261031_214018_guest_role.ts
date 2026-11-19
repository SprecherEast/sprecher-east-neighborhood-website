import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// The `guest` role (#520). `role` is a plain text column, so the new option needs no schema change,
// only data. The generated migration also rebuilt `users` to change the column's DB-level DEFAULT
// from 'resident' to 'guest'. That is left out on purpose: migrations run in a transaction, where
// SQLite ignores `PRAGMA foreign_keys=OFF`, so dropping `users` would delete its sessions and the
// rows that point at it (ON DELETE cascade). Payload always writes `role` (its own `defaultValue`,
// and sign-up sets it), so the old DB default is never used. The snapshot (.json) holds `guest`.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Nobody's address has been verified yet (#314), so every existing resident becomes a guest
  await db.run(sql`UPDATE \`users\` SET \`role\` = 'guest' WHERE \`role\` = 'resident';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Guests go back to resident, the only default role before this migration. Accounts created as
  // guests since then become residents too: the old model has no guest.
  await db.run(sql`UPDATE \`users\` SET \`role\` = 'resident' WHERE \`role\` = 'guest';`)
}
