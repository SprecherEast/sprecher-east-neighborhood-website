import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`search\` ADD \`cancelled\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`search\` ADD \`source_name\` text;`)
  await db.run(sql`ALTER TABLE \`search\` ADD \`source_url\` text;`)
  // Fills the new columns on existing entries from their post or event (#471, #492), so search
  // shows them without a reindex. Later saves keep them in step through the search sync.
  await db.run(sql`UPDATE \`search\` SET
    \`cancelled\` = COALESCE((
      SELECT e.\`cancelled\` FROM \`search_rels\` r JOIN \`events\` e ON e.\`id\` = r.\`events_id\`
      WHERE r.\`parent_id\` = \`search\`.\`id\` AND r.\`path\` = 'doc'
    ), false),
    \`source_name\` = (
      SELECT COALESCE(p.\`source_name\`, e.\`source_name\`) FROM \`search_rels\` r
      LEFT JOIN \`posts\` p ON p.\`id\` = r.\`posts_id\`
      LEFT JOIN \`events\` e ON e.\`id\` = r.\`events_id\`
      WHERE r.\`parent_id\` = \`search\`.\`id\` AND r.\`path\` = 'doc'
    ),
    \`source_url\` = (
      SELECT COALESCE(p.\`source_url\`, e.\`source_url\`) FROM \`search_rels\` r
      LEFT JOIN \`posts\` p ON p.\`id\` = r.\`posts_id\`
      LEFT JOIN \`events\` e ON e.\`id\` = r.\`events_id\`
      WHERE r.\`parent_id\` = \`search\`.\`id\` AND r.\`path\` = 'doc'
    );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`search\` DROP COLUMN \`cancelled\`;`)
  await db.run(sql`ALTER TABLE \`search\` DROP COLUMN \`source_name\`;`)
  await db.run(sql`ALTER TABLE \`search\` DROP COLUMN \`source_url\`;`)
}
