import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` ADD \`share_bar_schools\` numeric;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` ADD \`share_bar_city\` numeric;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` ADD \`share_bar_county\` numeric;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` ADD \`share_bar_matc\` numeric;`)
  await db.run(
    sql`ALTER TABLE \`_pages_v_blocks_content_columns\` ADD \`share_bar_schools\` numeric;`,
  )
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_content_columns\` ADD \`share_bar_city\` numeric;`)
  await db.run(
    sql`ALTER TABLE \`_pages_v_blocks_content_columns\` ADD \`share_bar_county\` numeric;`,
  )
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_content_columns\` ADD \`share_bar_matc\` numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` DROP COLUMN \`share_bar_schools\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` DROP COLUMN \`share_bar_city\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` DROP COLUMN \`share_bar_county\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_content_columns\` DROP COLUMN \`share_bar_matc\`;`)
  await db.run(
    sql`ALTER TABLE \`_pages_v_blocks_content_columns\` DROP COLUMN \`share_bar_schools\`;`,
  )
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_content_columns\` DROP COLUMN \`share_bar_city\`;`)
  await db.run(
    sql`ALTER TABLE \`_pages_v_blocks_content_columns\` DROP COLUMN \`share_bar_county\`;`,
  )
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_content_columns\` DROP COLUMN \`share_bar_matc\`;`)
}
