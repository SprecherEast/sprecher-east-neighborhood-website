import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`events\` ADD \`official_body\` text;`)
  await db.run(sql`ALTER TABLE \`events\` ADD \`agenda_url\` text;`)
  await db.run(sql`ALTER TABLE \`_events_v\` ADD \`version_official_body\` text;`)
  await db.run(sql`ALTER TABLE \`_events_v\` ADD \`version_agenda_url\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`events\` DROP COLUMN \`official_body\`;`)
  await db.run(sql`ALTER TABLE \`events\` DROP COLUMN \`agenda_url\`;`)
  await db.run(sql`ALTER TABLE \`_events_v\` DROP COLUMN \`version_official_body\`;`)
  await db.run(sql`ALTER TABLE \`_events_v\` DROP COLUMN \`version_agenda_url\`;`)
}
