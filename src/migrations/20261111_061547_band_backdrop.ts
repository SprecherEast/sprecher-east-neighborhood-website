import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`posts\` ADD \`backdrop_phone_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`posts\` ADD \`backdrop_tablet_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`posts\` ADD \`backdrop_desktop_id\` integer REFERENCES media(id);`)
  await db.run(
    sql`CREATE INDEX \`posts_backdrop_backdrop_phone_idx\` ON \`posts\` (\`backdrop_phone_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`posts_backdrop_backdrop_tablet_idx\` ON \`posts\` (\`backdrop_tablet_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`posts_backdrop_backdrop_desktop_idx\` ON \`posts\` (\`backdrop_desktop_id\`);`,
  )
  await db.run(
    sql`ALTER TABLE \`_posts_v\` ADD \`version_backdrop_phone_id\` integer REFERENCES media(id);`,
  )
  await db.run(
    sql`ALTER TABLE \`_posts_v\` ADD \`version_backdrop_tablet_id\` integer REFERENCES media(id);`,
  )
  await db.run(
    sql`ALTER TABLE \`_posts_v\` ADD \`version_backdrop_desktop_id\` integer REFERENCES media(id);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_backdrop_version_backdrop_phone_idx\` ON \`_posts_v\` (\`version_backdrop_phone_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_backdrop_version_backdrop_tablet_idx\` ON \`_posts_v\` (\`version_backdrop_tablet_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_backdrop_version_backdrop_desktop_idx\` ON \`_posts_v\` (\`version_backdrop_desktop_id\`);`,
  )
  await db.run(sql`ALTER TABLE \`events\` ADD \`backdrop_phone_id\` integer REFERENCES media(id);`)
  await db.run(sql`ALTER TABLE \`events\` ADD \`backdrop_tablet_id\` integer REFERENCES media(id);`)
  await db.run(
    sql`ALTER TABLE \`events\` ADD \`backdrop_desktop_id\` integer REFERENCES media(id);`,
  )
  await db.run(
    sql`CREATE INDEX \`events_backdrop_backdrop_phone_idx\` ON \`events\` (\`backdrop_phone_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`events_backdrop_backdrop_tablet_idx\` ON \`events\` (\`backdrop_tablet_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`events_backdrop_backdrop_desktop_idx\` ON \`events\` (\`backdrop_desktop_id\`);`,
  )
  await db.run(
    sql`ALTER TABLE \`_events_v\` ADD \`version_backdrop_phone_id\` integer REFERENCES media(id);`,
  )
  await db.run(
    sql`ALTER TABLE \`_events_v\` ADD \`version_backdrop_tablet_id\` integer REFERENCES media(id);`,
  )
  await db.run(
    sql`ALTER TABLE \`_events_v\` ADD \`version_backdrop_desktop_id\` integer REFERENCES media(id);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_backdrop_version_backdrop_phone_idx\` ON \`_events_v\` (\`version_backdrop_phone_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_backdrop_version_backdrop_tablet_idx\` ON \`_events_v\` (\`version_backdrop_tablet_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_backdrop_version_backdrop_desktop_idx\` ON \`_events_v\` (\`version_backdrop_desktop_id\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_posts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`hero_image_id\` integer,
  	\`content\` text,
  	\`meta_title\` text,
  	\`meta_image_id\` integer,
  	\`meta_description\` text,
  	\`published_at\` text,
  	\`generate_slug\` integer DEFAULT true,
  	\`slug\` text,
  	\`moderation_status\` text,
  	\`source_name\` text,
  	\`source_url\` text,
  	\`external_id\` text,
  	\`content_hash\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_posts\`("id", "title", "hero_image_id", "content", "meta_title", "meta_image_id", "meta_description", "published_at", "generate_slug", "slug", "moderation_status", "source_name", "source_url", "external_id", "content_hash", "updated_at", "created_at", "_status") SELECT "id", "title", "hero_image_id", "content", "meta_title", "meta_image_id", "meta_description", "published_at", "generate_slug", "slug", "moderation_status", "source_name", "source_url", "external_id", "content_hash", "updated_at", "created_at", "_status" FROM \`posts\`;`,
  )
  await db.run(sql`DROP TABLE \`posts\`;`)
  await db.run(sql`ALTER TABLE \`__new_posts\` RENAME TO \`posts\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`posts_hero_image_idx\` ON \`posts\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_meta_meta_image_idx\` ON \`posts\` (\`meta_image_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_slug_idx\` ON \`posts\` (\`slug\`);`)
  await db.run(
    sql`CREATE INDEX \`posts_moderation_status_idx\` ON \`posts\` (\`moderation_status\`);`,
  )
  await db.run(sql`CREATE UNIQUE INDEX \`posts_external_id_idx\` ON \`posts\` (\`external_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_content_hash_idx\` ON \`posts\` (\`content_hash\`);`)
  await db.run(sql`CREATE INDEX \`posts_updated_at_idx\` ON \`posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_created_at_idx\` ON \`posts\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`posts__status_idx\` ON \`posts\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`__new__posts_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_hero_image_id\` integer,
  	\`version_content\` text,
  	\`version_meta_title\` text,
  	\`version_meta_image_id\` integer,
  	\`version_meta_description\` text,
  	\`version_published_at\` text,
  	\`version_generate_slug\` integer DEFAULT true,
  	\`version_slug\` text,
  	\`version_moderation_status\` text,
  	\`version_source_name\` text,
  	\`version_source_url\` text,
  	\`version_external_id\` text,
  	\`version_content_hash\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new__posts_v\`("id", "parent_id", "version_title", "version_hero_image_id", "version_content", "version_meta_title", "version_meta_image_id", "version_meta_description", "version_published_at", "version_generate_slug", "version_slug", "version_moderation_status", "version_source_name", "version_source_url", "version_external_id", "version_content_hash", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave") SELECT "id", "parent_id", "version_title", "version_hero_image_id", "version_content", "version_meta_title", "version_meta_image_id", "version_meta_description", "version_published_at", "version_generate_slug", "version_slug", "version_moderation_status", "version_source_name", "version_source_url", "version_external_id", "version_content_hash", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave" FROM \`_posts_v\`;`,
  )
  await db.run(sql`DROP TABLE \`_posts_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__posts_v\` RENAME TO \`_posts_v\`;`)
  await db.run(sql`CREATE INDEX \`_posts_v_parent_idx\` ON \`_posts_v\` (\`parent_id\`);`)
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_version_hero_image_idx\` ON \`_posts_v\` (\`version_hero_image_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_meta_version_meta_image_idx\` ON \`_posts_v\` (\`version_meta_image_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_version_slug_idx\` ON \`_posts_v\` (\`version_slug\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_version_moderation_status_idx\` ON \`_posts_v\` (\`version_moderation_status\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_version_external_id_idx\` ON \`_posts_v\` (\`version_external_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_version_content_hash_idx\` ON \`_posts_v\` (\`version_content_hash\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_version_updated_at_idx\` ON \`_posts_v\` (\`version_updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_version_created_at_idx\` ON \`_posts_v\` (\`version_created_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_posts_v_version_version__status_idx\` ON \`_posts_v\` (\`version__status\`);`,
  )
  await db.run(sql`CREATE INDEX \`_posts_v_created_at_idx\` ON \`_posts_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_updated_at_idx\` ON \`_posts_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_latest_idx\` ON \`_posts_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_autosave_idx\` ON \`_posts_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`__new_events\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`date\` text,
  	\`time_start\` text,
  	\`time_end\` text,
  	\`cancelled\` integer DEFAULT false,
  	\`official_body\` text,
  	\`agenda_url\` text,
  	\`featured\` integer DEFAULT false,
  	\`location_type\` text DEFAULT 'in-person',
  	\`location_name\` text,
  	\`location_address\` text,
  	\`maps_url\` text,
  	\`registration_url\` text,
  	\`hero_image_id\` integer,
  	\`description\` text,
  	\`content\` text,
  	\`meta_title\` text,
  	\`meta_image_id\` integer,
  	\`meta_description\` text,
  	\`published_at\` text,
  	\`generate_slug\` integer DEFAULT true,
  	\`slug\` text,
  	\`moderation_status\` text,
  	\`source_name\` text,
  	\`source_url\` text,
  	\`external_id\` text,
  	\`content_hash\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_events\`("id", "title", "date", "time_start", "time_end", "cancelled", "official_body", "agenda_url", "featured", "location_type", "location_name", "location_address", "maps_url", "registration_url", "hero_image_id", "description", "content", "meta_title", "meta_image_id", "meta_description", "published_at", "generate_slug", "slug", "moderation_status", "source_name", "source_url", "external_id", "content_hash", "updated_at", "created_at", "_status") SELECT "id", "title", "date", "time_start", "time_end", "cancelled", "official_body", "agenda_url", "featured", "location_type", "location_name", "location_address", "maps_url", "registration_url", "hero_image_id", "description", "content", "meta_title", "meta_image_id", "meta_description", "published_at", "generate_slug", "slug", "moderation_status", "source_name", "source_url", "external_id", "content_hash", "updated_at", "created_at", "_status" FROM \`events\`;`,
  )
  await db.run(sql`DROP TABLE \`events\`;`)
  await db.run(sql`ALTER TABLE \`__new_events\` RENAME TO \`events\`;`)
  await db.run(sql`CREATE INDEX \`events_hero_image_idx\` ON \`events\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`events_meta_meta_image_idx\` ON \`events\` (\`meta_image_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`events_slug_idx\` ON \`events\` (\`slug\`);`)
  await db.run(
    sql`CREATE INDEX \`events_moderation_status_idx\` ON \`events\` (\`moderation_status\`);`,
  )
  await db.run(sql`CREATE UNIQUE INDEX \`events_external_id_idx\` ON \`events\` (\`external_id\`);`)
  await db.run(
    sql`CREATE UNIQUE INDEX \`events_content_hash_idx\` ON \`events\` (\`content_hash\`);`,
  )
  await db.run(sql`CREATE INDEX \`events_updated_at_idx\` ON \`events\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`events_created_at_idx\` ON \`events\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`events__status_idx\` ON \`events\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`__new__events_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_date\` text,
  	\`version_time_start\` text,
  	\`version_time_end\` text,
  	\`version_cancelled\` integer DEFAULT false,
  	\`version_official_body\` text,
  	\`version_agenda_url\` text,
  	\`version_featured\` integer DEFAULT false,
  	\`version_location_type\` text DEFAULT 'in-person',
  	\`version_location_name\` text,
  	\`version_location_address\` text,
  	\`version_maps_url\` text,
  	\`version_registration_url\` text,
  	\`version_hero_image_id\` integer,
  	\`version_description\` text,
  	\`version_content\` text,
  	\`version_meta_title\` text,
  	\`version_meta_image_id\` integer,
  	\`version_meta_description\` text,
  	\`version_published_at\` text,
  	\`version_generate_slug\` integer DEFAULT true,
  	\`version_slug\` text,
  	\`version_moderation_status\` text,
  	\`version_source_name\` text,
  	\`version_source_url\` text,
  	\`version_external_id\` text,
  	\`version_content_hash\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`events\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new__events_v\`("id", "parent_id", "version_title", "version_date", "version_time_start", "version_time_end", "version_cancelled", "version_official_body", "version_agenda_url", "version_featured", "version_location_type", "version_location_name", "version_location_address", "version_maps_url", "version_registration_url", "version_hero_image_id", "version_description", "version_content", "version_meta_title", "version_meta_image_id", "version_meta_description", "version_published_at", "version_generate_slug", "version_slug", "version_moderation_status", "version_source_name", "version_source_url", "version_external_id", "version_content_hash", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave") SELECT "id", "parent_id", "version_title", "version_date", "version_time_start", "version_time_end", "version_cancelled", "version_official_body", "version_agenda_url", "version_featured", "version_location_type", "version_location_name", "version_location_address", "version_maps_url", "version_registration_url", "version_hero_image_id", "version_description", "version_content", "version_meta_title", "version_meta_image_id", "version_meta_description", "version_published_at", "version_generate_slug", "version_slug", "version_moderation_status", "version_source_name", "version_source_url", "version_external_id", "version_content_hash", "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest", "autosave" FROM \`_events_v\`;`,
  )
  await db.run(sql`DROP TABLE \`_events_v\`;`)
  await db.run(sql`ALTER TABLE \`__new__events_v\` RENAME TO \`_events_v\`;`)
  await db.run(sql`CREATE INDEX \`_events_v_parent_idx\` ON \`_events_v\` (\`parent_id\`);`)
  await db.run(
    sql`CREATE INDEX \`_events_v_version_version_hero_image_idx\` ON \`_events_v\` (\`version_hero_image_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_meta_version_meta_image_idx\` ON \`_events_v\` (\`version_meta_image_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_version_slug_idx\` ON \`_events_v\` (\`version_slug\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_version_moderation_status_idx\` ON \`_events_v\` (\`version_moderation_status\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_version_external_id_idx\` ON \`_events_v\` (\`version_external_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_version_content_hash_idx\` ON \`_events_v\` (\`version_content_hash\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_version_updated_at_idx\` ON \`_events_v\` (\`version_updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_version_created_at_idx\` ON \`_events_v\` (\`version_created_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`_events_v_version_version__status_idx\` ON \`_events_v\` (\`version__status\`);`,
  )
  await db.run(sql`CREATE INDEX \`_events_v_created_at_idx\` ON \`_events_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_updated_at_idx\` ON \`_events_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_latest_idx\` ON \`_events_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_events_v_autosave_idx\` ON \`_events_v\` (\`autosave\`);`)
}
