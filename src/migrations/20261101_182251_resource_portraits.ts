import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`resources_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`url\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`resources_links_order_idx\` ON \`resources_links\` (\`_order\`);`)
  await db.run(
    sql`CREATE INDEX \`resources_links_parent_id_idx\` ON \`resources_links\` (\`_parent_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`_resources_v_version_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`url\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_resources_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`_resources_v_version_links_order_idx\` ON \`_resources_v_version_links\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_resources_v_version_links_parent_id_idx\` ON \`_resources_v_version_links\` (\`_parent_id\`);`,
  )
  // `down` keeps the two photo columns (see there), so a second `up` finds them in place
  const hasColumn = async (table: string, column: string) =>
    ((await db.all(sql`SELECT name FROM pragma_table_info(${table})`)) as { name: string }[]).some(
      ({ name }) => name === column,
    )
  if (!(await hasColumn('resources', 'photo_id'))) {
    await db.run(
      sql`ALTER TABLE \`resources\` ADD \`photo_id\` integer REFERENCES media(id) ON DELETE SET NULL ON UPDATE NO ACTION;`,
    )
  }
  if (!(await hasColumn('_resources_v', 'version_photo_id'))) {
    await db.run(
      sql`ALTER TABLE \`_resources_v\` ADD \`version_photo_id\` integer REFERENCES media(id) ON DELETE SET NULL ON UPDATE NO ACTION;`,
    )
  }
  await db.run(sql`ALTER TABLE \`resources\` ADD \`photo_credit\` text;`)
  await db.run(sql`ALTER TABLE \`resources\` ADD \`photo_source_url\` text;`)
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`resources_photo_idx\` ON \`resources\` (\`photo_id\`);`,
  )
  await db.run(sql`ALTER TABLE \`_resources_v\` ADD \`version_photo_credit\` text;`)
  await db.run(sql`ALTER TABLE \`_resources_v\` ADD \`version_photo_source_url\` text;`)
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_resources_v_version_version_photo_idx\` ON \`_resources_v\` (\`version_photo_id\`);`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // No table is rebuilt: migrations run in a transaction, where SQLite ignores
  // `PRAGMA foreign_keys=OFF`, so rebuilding `resources` would set every version's `parent_id`
  // to NULL and detach the resources' history (as the guest-role migration notes for `users`).
  await db.run(sql`DROP TABLE \`resources_links\`;`)
  await db.run(sql`DROP TABLE \`_resources_v_version_links\`;`)
  await db.run(sql`ALTER TABLE \`resources\` DROP COLUMN \`photo_credit\`;`)
  await db.run(sql`ALTER TABLE \`resources\` DROP COLUMN \`photo_source_url\`;`)
  await db.run(sql`ALTER TABLE \`_resources_v\` DROP COLUMN \`version_photo_credit\`;`)
  await db.run(sql`ALTER TABLE \`_resources_v\` DROP COLUMN \`version_photo_source_url\`;`)
  // The photo columns stay, emptied: SQLite can't drop a column with a foreign key, and a rebuild
  // would detach the history as above. The old schema ignores them.
  await db.run(sql`UPDATE \`resources\` SET \`photo_id\` = NULL;`)
  await db.run(sql`UPDATE \`_resources_v\` SET \`version_photo_id\` = NULL;`)
}
