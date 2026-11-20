import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD \`google_sub\` text;`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_google_sub_idx\` ON \`users\` (\`google_sub\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`users_google_sub_idx\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`google_sub\`;`)
}
