import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`pages_blocks_events_this_week_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`source\` text DEFAULT 'all',
  	\`category_id\` integer,
  	\`limit\` numeric DEFAULT 3,
  	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_events_this_week\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`pages_blocks_events_this_week_rows_order_idx\` ON \`pages_blocks_events_this_week_rows\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`pages_blocks_events_this_week_rows_parent_id_idx\` ON \`pages_blocks_events_this_week_rows\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`pages_blocks_events_this_week_rows_category_idx\` ON \`pages_blocks_events_this_week_rows\` (\`category_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`pages_blocks_events_this_week\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`heading\` text DEFAULT 'This week in Sprecher East',
  	\`days\` numeric DEFAULT 7,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`pages_blocks_events_this_week_order_idx\` ON \`pages_blocks_events_this_week\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`pages_blocks_events_this_week_parent_id_idx\` ON \`pages_blocks_events_this_week\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`pages_blocks_events_this_week_path_idx\` ON \`pages_blocks_events_this_week\` (\`_path\`);`,
  )
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_events_this_week_rows\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`source\` text DEFAULT 'all',
  	\`category_id\` integer,
  	\`limit\` numeric DEFAULT 3,
  	\`_uuid\` text,
  	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_events_this_week\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_events_this_week_rows_order_idx\` ON \`_pages_v_blocks_events_this_week_rows\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_events_this_week_rows_parent_id_idx\` ON \`_pages_v_blocks_events_this_week_rows\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_events_this_week_rows_category_idx\` ON \`_pages_v_blocks_events_this_week_rows\` (\`category_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_events_this_week\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`heading\` text DEFAULT 'This week in Sprecher East',
  	\`days\` numeric DEFAULT 7,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_events_this_week_order_idx\` ON \`_pages_v_blocks_events_this_week\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_events_this_week_parent_id_idx\` ON \`_pages_v_blocks_events_this_week\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_events_this_week_path_idx\` ON \`_pages_v_blocks_events_this_week\` (\`_path\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`pages_blocks_events_this_week_rows\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_events_this_week\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_events_this_week_rows\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_events_this_week\`;`)
}
