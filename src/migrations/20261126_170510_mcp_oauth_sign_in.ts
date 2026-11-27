import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`oauth_clients_redirect_uris\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`uri\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`oauth_clients\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`oauth_clients_redirect_uris_order_idx\` ON \`oauth_clients_redirect_uris\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`oauth_clients_redirect_uris_parent_id_idx\` ON \`oauth_clients_redirect_uris\` (\`_parent_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`oauth_clients\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`client_id\` text,
  	\`agent_id\` integer NOT NULL,
  	\`enabled\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`agent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`CREATE UNIQUE INDEX \`oauth_clients_client_id_idx\` ON \`oauth_clients\` (\`client_id\`);`,
  )
  await db.run(sql`CREATE INDEX \`oauth_clients_agent_idx\` ON \`oauth_clients\` (\`agent_id\`);`)
  await db.run(
    sql`CREATE INDEX \`oauth_clients_updated_at_idx\` ON \`oauth_clients\` (\`updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`oauth_clients_created_at_idx\` ON \`oauth_clients\` (\`created_at\`);`,
  )
  await db.run(sql`CREATE TABLE \`oauth_tokens\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`kind\` text NOT NULL,
  	\`token_hash\` text NOT NULL,
  	\`family\` text NOT NULL,
  	\`client_id\` integer NOT NULL,
  	\`agent_id\` integer NOT NULL,
  	\`consented_by_id\` integer,
  	\`resource\` text NOT NULL,
  	\`scope\` text,
  	\`expires_at\` text NOT NULL,
  	\`used_at\` text,
  	\`revoked_at\` text,
  	\`redirect_uri\` text,
  	\`code_challenge\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`client_id\`) REFERENCES \`oauth_clients\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`agent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`consented_by_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`CREATE UNIQUE INDEX \`oauth_tokens_token_hash_idx\` ON \`oauth_tokens\` (\`token_hash\`);`,
  )
  await db.run(sql`CREATE INDEX \`oauth_tokens_family_idx\` ON \`oauth_tokens\` (\`family\`);`)
  await db.run(sql`CREATE INDEX \`oauth_tokens_client_idx\` ON \`oauth_tokens\` (\`client_id\`);`)
  await db.run(sql`CREATE INDEX \`oauth_tokens_agent_idx\` ON \`oauth_tokens\` (\`agent_id\`);`)
  await db.run(
    sql`CREATE INDEX \`oauth_tokens_consented_by_idx\` ON \`oauth_tokens\` (\`consented_by_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`oauth_tokens_expires_at_idx\` ON \`oauth_tokens\` (\`expires_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`oauth_tokens_updated_at_idx\` ON \`oauth_tokens\` (\`updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`oauth_tokens_created_at_idx\` ON \`oauth_tokens\` (\`created_at\`);`,
  )
  await db.run(
    sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`oauth_clients_id\` integer REFERENCES oauth_clients(id) ON UPDATE no action ON DELETE cascade;`,
  )
  await db.run(
    sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`oauth_tokens_id\` integer REFERENCES oauth_tokens(id) ON UPDATE no action ON DELETE cascade;`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_oauth_clients_id_idx\` ON \`payload_locked_documents_rels\` (\`oauth_clients_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_oauth_tokens_id_idx\` ON \`payload_locked_documents_rels\` (\`oauth_tokens_id\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Under foreign-key enforcement nothing may still point at the tables this drops, and SQLite
  // ignores PRAGMA foreign_keys inside the migration's transaction. So, in order: forget edit
  // locks that point at a client or a token (their rel rows go with them), rebuild the rels table
  // without those columns, then drop the tables, tokens before the clients they point at.
  await db.run(
    sql`DELETE FROM \`payload_locked_documents\` WHERE \`id\` IN (SELECT \`parent_id\` FROM \`payload_locked_documents_rels\` WHERE \`oauth_clients_id\` IS NOT NULL OR \`oauth_tokens_id\` IS NOT NULL);`,
  )
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
  	\`passkeys_id\` integer,
  	\`passkey_challenges_id\` integer,
  	\`social_link_requests_id\` integer,
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
  	FOREIGN KEY (\`passkeys_id\`) REFERENCES \`passkeys\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`passkey_challenges_id\`) REFERENCES \`passkey_challenges\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`social_link_requests_id\`) REFERENCES \`social_link_requests\`(\`id\`) ON UPDATE no action ON DELETE cascade,
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
    sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "pages_id", "posts_id", "events_id", "team_members_id", "resources_id", "faq_id", "media_id", "categories_id", "users_id", "passkeys_id", "passkey_challenges_id", "social_link_requests_id", "email_confirmations_id", "agent_runs_id", "agent_review_items_id", "redirects_id", "forms_id", "form_submissions_id", "search_id", "payload_mcp_api_keys_id", "payload_folders_id") SELECT "id", "order", "parent_id", "path", "pages_id", "posts_id", "events_id", "team_members_id", "resources_id", "faq_id", "media_id", "categories_id", "users_id", "passkeys_id", "passkey_challenges_id", "social_link_requests_id", "email_confirmations_id", "agent_runs_id", "agent_review_items_id", "redirects_id", "forms_id", "form_submissions_id", "search_id", "payload_mcp_api_keys_id", "payload_folders_id" FROM \`payload_locked_documents_rels\`;`,
  )
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(
    sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`,
  )
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`DROP TABLE \`oauth_tokens\`;`)
  await db.run(sql`DROP TABLE \`oauth_clients_redirect_uris\`;`)
  await db.run(sql`DROP TABLE \`oauth_clients\`;`)
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
    sql`CREATE INDEX \`payload_locked_documents_rels_passkeys_id_idx\` ON \`payload_locked_documents_rels\` (\`passkeys_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_passkey_challenges_id_idx\` ON \`payload_locked_documents_rels\` (\`passkey_challenges_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_social_link_requests_id_idx\` ON \`payload_locked_documents_rels\` (\`social_link_requests_id\`);`,
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
}
