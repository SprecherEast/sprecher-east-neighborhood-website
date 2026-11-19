import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * #391: a nullable, server-only column for the hash of the link that verified an account, so the
 * verify page can say a link opened again was already used. Existing rows stay empty.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD \`verified_token_hash\` text;`)
  await db.run(
    sql`CREATE INDEX \`users_verified_token_hash_idx\` ON \`users\` (\`verified_token_hash\`);`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`users_verified_token_hash_idx\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`verified_token_hash\`;`)
}
