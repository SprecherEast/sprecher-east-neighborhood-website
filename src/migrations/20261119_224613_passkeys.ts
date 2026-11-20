import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`passkeys\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`account_id\` integer NOT NULL,
  	\`credential_id\` text NOT NULL,
  	\`public_key\` text NOT NULL,
  	\`counter\` numeric DEFAULT 0 NOT NULL,
  	\`transports\` text,
  	\`device_type\` text NOT NULL,
  	\`backed_up\` integer DEFAULT false,
  	\`label\` text NOT NULL,
  	\`last_used_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`account_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`passkeys_account_idx\` ON \`passkeys\` (\`account_id\`);`)
  await db.run(
    sql`CREATE UNIQUE INDEX \`passkeys_credential_id_idx\` ON \`passkeys\` (\`credential_id\`);`,
  )
  await db.run(sql`CREATE INDEX \`passkeys_updated_at_idx\` ON \`passkeys\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`passkeys_created_at_idx\` ON \`passkeys\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`passkey_challenges\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`purpose\` text NOT NULL,
  	\`challenge\` text NOT NULL,
  	\`expires_at\` text NOT NULL,
  	\`used_at\` text,
  	\`account_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`account_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`CREATE INDEX \`passkey_challenges_expires_at_idx\` ON \`passkey_challenges\` (\`expires_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`passkey_challenges_account_idx\` ON \`passkey_challenges\` (\`account_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`passkey_challenges_updated_at_idx\` ON \`passkey_challenges\` (\`updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`passkey_challenges_created_at_idx\` ON \`passkey_challenges\` (\`created_at\`);`,
  )
  await db.run(sql`ALTER TABLE \`users\` ADD \`passkey_user_handle\` text;`)
  await db.run(
    sql`CREATE UNIQUE INDEX \`users_passkey_user_handle_idx\` ON \`users\` (\`passkey_user_handle\`);`,
  )
  await db.run(
    sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`passkeys_id\` integer REFERENCES passkeys(id);`,
  )
  await db.run(
    sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`passkey_challenges_id\` integer REFERENCES passkey_challenges(id);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_passkeys_id_idx\` ON \`payload_locked_documents_rels\` (\`passkeys_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_passkey_challenges_id_idx\` ON \`payload_locked_documents_rels\` (\`passkey_challenges_id\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`passkeys\`;`)
  await db.run(sql`DROP TABLE \`passkey_challenges\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`pages_id\` integer,
  	\`posts_id\` integer,
  	\`events_id\` integer,
  	\`team_members_id\` integer,
  	\`resources_id\` integer,
  	\`faq_id\` integer,
  	\`media_id\` integer,
  	\`categories_id\` integer,
  	\`users_id\` integer,
  	\`email_confirmations_id\` integer,
  	\`agent_runs_id\` integer,
  	\`agent_review_items_id\` integer,
  	\`redirects_id\` integer,
  	\`forms_id\` integer,
  	\`form_submissions_id\` integer,
  	\`search_id\` integer,
  	\`payload_mcp_api_keys_id\` integer,
  	\`payload_folders_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`events_id\`) REFERENCES \`events\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`team_members_id\`) REFERENCES \`team_members\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`resources_id\`) REFERENCES \`resources\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`faq_id\`) REFERENCES \`faq\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`email_confirmations_id\`) REFERENCES \`email_confirmations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`agent_runs_id\`) REFERENCES \`agent_runs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`agent_review_items_id\`) REFERENCES \`agent_review_items\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`redirects_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`forms_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`form_submissions_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`search_id\`) REFERENCES \`search\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`payload_mcp_api_keys_id\`) REFERENCES \`payload_mcp_api_keys\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`payload_folders_id\`) REFERENCES \`payload_folders\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "pages_id", "posts_id", "events_id", "team_members_id", "resources_id", "faq_id", "media_id", "categories_id", "users_id", "email_confirmations_id", "agent_runs_id", "agent_review_items_id", "redirects_id", "forms_id", "form_submissions_id", "search_id", "payload_mcp_api_keys_id", "payload_folders_id") SELECT "id", "order", "parent_id", "path", "pages_id", "posts_id", "events_id", "team_members_id", "resources_id", "faq_id", "media_id", "categories_id", "users_id", "email_confirmations_id", "agent_runs_id", "agent_review_items_id", "redirects_id", "forms_id", "form_submissions_id", "search_id", "payload_mcp_api_keys_id", "payload_folders_id" FROM \`payload_locked_documents_rels\`;`,
  )
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(
    sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`,
  )
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_events_id_idx\` ON \`payload_locked_documents_rels\` (\`events_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_team_members_id_idx\` ON \`payload_locked_documents_rels\` (\`team_members_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_resources_id_idx\` ON \`payload_locked_documents_rels\` (\`resources_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_faq_id_idx\` ON \`payload_locked_documents_rels\` (\`faq_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_email_confirmations_id_idx\` ON \`payload_locked_documents_rels\` (\`email_confirmations_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_agent_runs_id_idx\` ON \`payload_locked_documents_rels\` (\`agent_runs_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_agent_review_items_id_idx\` ON \`payload_locked_documents_rels\` (\`agent_review_items_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_redirects_id_idx\` ON \`payload_locked_documents_rels\` (\`redirects_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_forms_id_idx\` ON \`payload_locked_documents_rels\` (\`forms_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_form_submissions_id_idx\` ON \`payload_locked_documents_rels\` (\`form_submissions_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_search_id_idx\` ON \`payload_locked_documents_rels\` (\`search_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_payload_mcp_api_keys_id_idx\` ON \`payload_locked_documents_rels\` (\`payload_mcp_api_keys_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_payload_folders_id_idx\` ON \`payload_locked_documents_rels\` (\`payload_folders_id\`);`,
  )
  await db.run(sql`DROP INDEX \`users_passkey_user_handle_idx\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`passkey_user_handle\`;`)
}
