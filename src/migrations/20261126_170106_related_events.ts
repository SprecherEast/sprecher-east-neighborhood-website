import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`posts_rels\` ADD \`events_id\` integer REFERENCES events(id);`)
  await db.run(sql`CREATE INDEX \`posts_rels_events_id_idx\` ON \`posts_rels\` (\`events_id\`);`)
  await db.run(sql`ALTER TABLE \`_posts_v_rels\` ADD \`events_id\` integer REFERENCES events(id);`)
  await db.run(
    sql`CREATE INDEX \`_posts_v_rels_events_id_idx\` ON \`_posts_v_rels\` (\`events_id\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_posts_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`posts_id\` integer,
  	\`categories_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_posts_rels\`("id", "order", "parent_id", "path", "posts_id", "categories_id", "users_id") SELECT "id", "order", "parent_id", "path", "posts_id", "categories_id", "users_id" FROM \`posts_rels\`;`,
  )
  await db.run(sql`DROP TABLE \`posts_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_posts_rels\` RENAME TO \`posts_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`posts_rels_order_idx\` ON \`posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_parent_idx\` ON \`posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_path_idx\` ON \`posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_posts_id_idx\` ON \`posts_rels\` (\`posts_id\`);`)
  await db.run(
    sql`CREATE INDEX \`posts_rels_categories_id_idx\` ON \`posts_rels\` (\`categories_id\`);`,
  )
  await db.run(sql`CREATE INDEX \`posts_rels_users_id_idx\` ON \`posts_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`__new__posts_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`posts_id\` integer,
  	\`categories_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_posts_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new__posts_v_rels\`("id", "order", "parent_id", "path", "posts_id", "categories_id", "users_id") SELECT "id", "order", "parent_id", "path", "posts_id", "categories_id", "users_id" FROM \`_posts_v_rels\`;`,
  )
  await db.run(sql`DROP TABLE \`_posts_v_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new__posts_v_rels\` RENAME TO \`_posts_v_rels\`;`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_order_idx\` ON \`_posts_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_parent_idx\` ON \`_posts_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_path_idx\` ON \`_posts_v_rels\` (\`path\`);`)
  await db.run(
    sql`CREATE INDEX \`_posts_v_rels_posts_id_idx\` ON \`_posts_v_rels\` (\`posts_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_rels_categories_id_idx\` ON \`_posts_v_rels\` (\`categories_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_rels_users_id_idx\` ON \`_posts_v_rels\` (\`users_id\`);`,
  )
}
