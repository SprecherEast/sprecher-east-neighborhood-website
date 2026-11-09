import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql`ALTER TABLE \`pages_blocks_content_columns\` ADD \`link_align\` text DEFAULT 'start';`,
  )
  await db.run(
    sql`ALTER TABLE \`_pages_v_blocks_content_columns\` ADD \`link_align\` text DEFAULT 'start';`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` DROP COLUMN \`link_align\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_content_columns\` DROP COLUMN \`link_align\`;`)
}
