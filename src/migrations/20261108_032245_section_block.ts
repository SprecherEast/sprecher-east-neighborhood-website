import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`pages_blocks_section_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'full',
  	\`align\` text DEFAULT 'start',
  	\`vertical_align\` text DEFAULT 'top',
  	\`phone_order\` text DEFAULT 'inOrder',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_section\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`pages_blocks_section_items_order_idx\` ON \`pages_blocks_section_items\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`pages_blocks_section_items_parent_id_idx\` ON \`pages_blocks_section_items\` (\`_parent_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`pages_blocks_section\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`pages_blocks_section_order_idx\` ON \`pages_blocks_section\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`pages_blocks_section_parent_id_idx\` ON \`pages_blocks_section\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`pages_blocks_section_path_idx\` ON \`pages_blocks_section\` (\`_path\`);`,
  )
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_section_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`width\` text DEFAULT 'full',
  	\`align\` text DEFAULT 'start',
  	\`vertical_align\` text DEFAULT 'top',
  	\`phone_order\` text DEFAULT 'inOrder',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_section\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_section_items_order_idx\` ON \`_pages_v_blocks_section_items\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_section_items_parent_id_idx\` ON \`_pages_v_blocks_section_items\` (\`_parent_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_section\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_section_order_idx\` ON \`_pages_v_blocks_section\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_section_parent_id_idx\` ON \`_pages_v_blocks_section\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_pages_v_blocks_section_path_idx\` ON \`_pages_v_blocks_section\` (\`_path\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`pages_blocks_section_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_section\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_section_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_section\`;`)
}
