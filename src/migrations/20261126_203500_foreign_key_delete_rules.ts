import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

/**
 * Gives the foreign keys that older migrations added with `ADD ... REFERENCES x(id)` (no delete rule,
 * so SQLite applies NO ACTION) the rule the schema gives them (#1559): SET NULL for the title band
 * photos of posts and events and their versions, CASCADE for the edit-lock and preference links to
 * the newer collections. Until then a media file used as a title band photo, and a document with an
 * edit lock row, could not be deleted. `down` puts the old NO ACTION back.
 *
 * SQLite cannot alter a foreign key, so each table is rebuilt as SQLite documents it
 * (https://sqlite.org/lang_altertable.html#otheralter) and as Payload's own generated migrations do:
 * a `__new_` table, a copy, drop, rename, then the indexes again. Two things differ from those, to
 * lose no row:
 *
 * - `PRAGMA foreign_keys` cannot change inside a transaction, so it is switched off first, then
 *   everything runs in one `BEGIN IMMEDIATE`, then it goes back to what it was. With it on, dropping
 *   `posts` would delete its rows and so cascade into the versions and lock rows that point at it.
 * - Before it starts, it checks that each table has exactly the columns and indexes written here and
 *   no trigger, so a table that differs on the live database is never rebuilt without something
 *   (a column's data, an index) it would drop.
 * - Before it commits, the migration checks that no table lost or gained a row, that
 *   `PRAGMA integrity_check` is `ok` and that `PRAGMA foreign_key_check` finds nothing it did not find
 *   before. Any failure rolls the whole transaction back, so the database stays as it was.
 */

type Spec = {
  table: string
  /** Column definitions in table order, a changed column without its REFERENCES clause. */
  columns: string[]
  /** Foreign keys that already have the right rule: kept as they are. */
  keys: string[]
  /** Foreign keys given the new rule. */
  changed: { column: string; references: string; onDelete: 'set null' | 'cascade' }[]
  indexes: string[]
}

const specs: Spec[] = [
  {
    table: 'posts',
    columns: [
      '`id` integer PRIMARY KEY NOT NULL',
      '`title` text',
      '`hero_image_id` integer',
      '`content` text',
      '`meta_title` text',
      '`meta_image_id` integer',
      '`meta_description` text',
      '`published_at` text',
      '`generate_slug` integer DEFAULT true',
      '`slug` text',
      "`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL",
      "`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL",
      "`_status` text DEFAULT 'draft'",
      '`moderation_status` text',
      '`source_name` text',
      '`source_url` text',
      '`external_id` text',
      '`content_hash` text',
      '`backdrop_phone_id` integer',
      '`backdrop_tablet_id` integer',
      '`backdrop_desktop_id` integer',
    ],
    keys: [
      'FOREIGN KEY (`hero_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null',
      'FOREIGN KEY (`meta_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null',
    ],
    changed: [
      { column: 'backdrop_phone_id', references: 'media', onDelete: 'set null' },
      { column: 'backdrop_tablet_id', references: 'media', onDelete: 'set null' },
      { column: 'backdrop_desktop_id', references: 'media', onDelete: 'set null' },
    ],
    indexes: [
      'CREATE INDEX `posts_hero_image_idx` ON `posts` (`hero_image_id`)',
      'CREATE INDEX `posts_meta_meta_image_idx` ON `posts` (`meta_image_id`)',
      'CREATE UNIQUE INDEX `posts_slug_idx` ON `posts` (`slug`)',
      'CREATE INDEX `posts_updated_at_idx` ON `posts` (`updated_at`)',
      'CREATE INDEX `posts_created_at_idx` ON `posts` (`created_at`)',
      'CREATE INDEX `posts__status_idx` ON `posts` (`_status`)',
      'CREATE INDEX `posts_moderation_status_idx` ON `posts` (`moderation_status`)',
      'CREATE UNIQUE INDEX `posts_external_id_idx` ON `posts` (`external_id`)',
      'CREATE UNIQUE INDEX `posts_content_hash_idx` ON `posts` (`content_hash`)',
      'CREATE INDEX `posts_backdrop_backdrop_phone_idx` ON `posts` (`backdrop_phone_id`)',
      'CREATE INDEX `posts_backdrop_backdrop_tablet_idx` ON `posts` (`backdrop_tablet_id`)',
      'CREATE INDEX `posts_backdrop_backdrop_desktop_idx` ON `posts` (`backdrop_desktop_id`)',
    ],
  },
  {
    table: '_posts_v',
    columns: [
      '`id` integer PRIMARY KEY NOT NULL',
      '`parent_id` integer',
      '`version_title` text',
      '`version_hero_image_id` integer',
      '`version_content` text',
      '`version_meta_title` text',
      '`version_meta_image_id` integer',
      '`version_meta_description` text',
      '`version_published_at` text',
      '`version_generate_slug` integer DEFAULT true',
      '`version_slug` text',
      '`version_updated_at` text',
      '`version_created_at` text',
      "`version__status` text DEFAULT 'draft'",
      "`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL",
      "`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL",
      '`latest` integer',
      '`autosave` integer',
      '`version_moderation_status` text',
      '`version_source_name` text',
      '`version_source_url` text',
      '`version_external_id` text',
      '`version_content_hash` text',
      '`version_backdrop_phone_id` integer',
      '`version_backdrop_tablet_id` integer',
      '`version_backdrop_desktop_id` integer',
    ],
    keys: [
      'FOREIGN KEY (`parent_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null',
      'FOREIGN KEY (`version_hero_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null',
      'FOREIGN KEY (`version_meta_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null',
    ],
    changed: [
      { column: 'version_backdrop_phone_id', references: 'media', onDelete: 'set null' },
      { column: 'version_backdrop_tablet_id', references: 'media', onDelete: 'set null' },
      { column: 'version_backdrop_desktop_id', references: 'media', onDelete: 'set null' },
    ],
    indexes: [
      'CREATE INDEX `_posts_v_parent_idx` ON `_posts_v` (`parent_id`)',
      'CREATE INDEX `_posts_v_version_version_hero_image_idx` ON `_posts_v` (`version_hero_image_id`)',
      'CREATE INDEX `_posts_v_version_meta_version_meta_image_idx` ON `_posts_v` (`version_meta_image_id`)',
      'CREATE INDEX `_posts_v_version_version_slug_idx` ON `_posts_v` (`version_slug`)',
      'CREATE INDEX `_posts_v_version_version_updated_at_idx` ON `_posts_v` (`version_updated_at`)',
      'CREATE INDEX `_posts_v_version_version_created_at_idx` ON `_posts_v` (`version_created_at`)',
      'CREATE INDEX `_posts_v_version_version__status_idx` ON `_posts_v` (`version__status`)',
      'CREATE INDEX `_posts_v_created_at_idx` ON `_posts_v` (`created_at`)',
      'CREATE INDEX `_posts_v_updated_at_idx` ON `_posts_v` (`updated_at`)',
      'CREATE INDEX `_posts_v_latest_idx` ON `_posts_v` (`latest`)',
      'CREATE INDEX `_posts_v_autosave_idx` ON `_posts_v` (`autosave`)',
      'CREATE INDEX `_posts_v_version_version_moderation_status_idx` ON `_posts_v` (`version_moderation_status`)',
      'CREATE INDEX `_posts_v_version_version_external_id_idx` ON `_posts_v` (`version_external_id`)',
      'CREATE INDEX `_posts_v_version_version_content_hash_idx` ON `_posts_v` (`version_content_hash`)',
      'CREATE INDEX `_posts_v_version_backdrop_version_backdrop_phone_idx` ON `_posts_v` (`version_backdrop_phone_id`)',
      'CREATE INDEX `_posts_v_version_backdrop_version_backdrop_tablet_idx` ON `_posts_v` (`version_backdrop_tablet_id`)',
      'CREATE INDEX `_posts_v_version_backdrop_version_backdrop_desktop_idx` ON `_posts_v` (`version_backdrop_desktop_id`)',
    ],
  },
  {
    table: 'events',
    columns: [
      '`id` integer PRIMARY KEY NOT NULL',
      '`title` text',
      '`date` text',
      '`time_start` text',
      '`time_end` text',
      '`featured` integer DEFAULT false',
      "`location_type` text DEFAULT 'in-person'",
      '`location_name` text',
      '`location_address` text',
      '`maps_url` text',
      '`registration_url` text',
      '`hero_image_id` integer',
      '`description` text',
      '`content` text',
      '`published_at` text',
      '`generate_slug` integer DEFAULT true',
      '`slug` text',
      "`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL",
      "`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL",
      "`_status` text DEFAULT 'draft'",
      '`meta_title` text',
      '`meta_image_id` integer REFERENCES media(id) ON DELETE SET NULL ON UPDATE NO ACTION',
      '`meta_description` text',
      '`cancelled` integer DEFAULT false',
      '`moderation_status` text',
      '`source_name` text',
      '`source_url` text',
      '`external_id` text',
      '`content_hash` text',
      '`official_body` text',
      '`agenda_url` text',
      '`backdrop_phone_id` integer',
      '`backdrop_tablet_id` integer',
      '`backdrop_desktop_id` integer',
    ],
    keys: [
      'FOREIGN KEY (`hero_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null',
    ],
    changed: [
      { column: 'backdrop_phone_id', references: 'media', onDelete: 'set null' },
      { column: 'backdrop_tablet_id', references: 'media', onDelete: 'set null' },
      { column: 'backdrop_desktop_id', references: 'media', onDelete: 'set null' },
    ],
    indexes: [
      'CREATE INDEX `events_hero_image_idx` ON `events` (`hero_image_id`)',
      'CREATE UNIQUE INDEX `events_slug_idx` ON `events` (`slug`)',
      'CREATE INDEX `events_updated_at_idx` ON `events` (`updated_at`)',
      'CREATE INDEX `events_created_at_idx` ON `events` (`created_at`)',
      'CREATE INDEX `events__status_idx` ON `events` (`_status`)',
      'CREATE INDEX `events_meta_meta_image_idx` ON `events` (`meta_image_id`)',
      'CREATE INDEX `events_moderation_status_idx` ON `events` (`moderation_status`)',
      'CREATE UNIQUE INDEX `events_external_id_idx` ON `events` (`external_id`)',
      'CREATE UNIQUE INDEX `events_content_hash_idx` ON `events` (`content_hash`)',
      'CREATE INDEX `events_backdrop_backdrop_phone_idx` ON `events` (`backdrop_phone_id`)',
      'CREATE INDEX `events_backdrop_backdrop_tablet_idx` ON `events` (`backdrop_tablet_id`)',
      'CREATE INDEX `events_backdrop_backdrop_desktop_idx` ON `events` (`backdrop_desktop_id`)',
    ],
  },
  {
    table: '_events_v',
    columns: [
      '`id` integer PRIMARY KEY NOT NULL',
      '`parent_id` integer',
      '`version_title` text',
      '`version_date` text',
      '`version_time_start` text',
      '`version_time_end` text',
      '`version_featured` integer DEFAULT false',
      "`version_location_type` text DEFAULT 'in-person'",
      '`version_location_name` text',
      '`version_location_address` text',
      '`version_maps_url` text',
      '`version_registration_url` text',
      '`version_hero_image_id` integer',
      '`version_description` text',
      '`version_content` text',
      '`version_published_at` text',
      '`version_generate_slug` integer DEFAULT true',
      '`version_slug` text',
      '`version_updated_at` text',
      '`version_created_at` text',
      "`version__status` text DEFAULT 'draft'",
      "`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL",
      "`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL",
      '`latest` integer',
      '`autosave` integer',
      '`version_meta_title` text',
      '`version_meta_image_id` integer REFERENCES media(id) ON DELETE SET NULL ON UPDATE NO ACTION',
      '`version_meta_description` text',
      '`version_cancelled` integer DEFAULT false',
      '`version_moderation_status` text',
      '`version_source_name` text',
      '`version_source_url` text',
      '`version_external_id` text',
      '`version_content_hash` text',
      '`version_official_body` text',
      '`version_agenda_url` text',
      '`version_backdrop_phone_id` integer',
      '`version_backdrop_tablet_id` integer',
      '`version_backdrop_desktop_id` integer',
    ],
    keys: [
      'FOREIGN KEY (`parent_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null',
      'FOREIGN KEY (`version_hero_image_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null',
    ],
    changed: [
      { column: 'version_backdrop_phone_id', references: 'media', onDelete: 'set null' },
      { column: 'version_backdrop_tablet_id', references: 'media', onDelete: 'set null' },
      { column: 'version_backdrop_desktop_id', references: 'media', onDelete: 'set null' },
    ],
    indexes: [
      'CREATE INDEX `_events_v_parent_idx` ON `_events_v` (`parent_id`)',
      'CREATE INDEX `_events_v_version_version_hero_image_idx` ON `_events_v` (`version_hero_image_id`)',
      'CREATE INDEX `_events_v_version_version_slug_idx` ON `_events_v` (`version_slug`)',
      'CREATE INDEX `_events_v_version_version_updated_at_idx` ON `_events_v` (`version_updated_at`)',
      'CREATE INDEX `_events_v_version_version_created_at_idx` ON `_events_v` (`version_created_at`)',
      'CREATE INDEX `_events_v_version_version__status_idx` ON `_events_v` (`version__status`)',
      'CREATE INDEX `_events_v_created_at_idx` ON `_events_v` (`created_at`)',
      'CREATE INDEX `_events_v_updated_at_idx` ON `_events_v` (`updated_at`)',
      'CREATE INDEX `_events_v_latest_idx` ON `_events_v` (`latest`)',
      'CREATE INDEX `_events_v_autosave_idx` ON `_events_v` (`autosave`)',
      'CREATE INDEX `_events_v_version_meta_version_meta_image_idx` ON `_events_v` (`version_meta_image_id`)',
      'CREATE INDEX `_events_v_version_version_moderation_status_idx` ON `_events_v` (`version_moderation_status`)',
      'CREATE INDEX `_events_v_version_version_external_id_idx` ON `_events_v` (`version_external_id`)',
      'CREATE INDEX `_events_v_version_version_content_hash_idx` ON `_events_v` (`version_content_hash`)',
      'CREATE INDEX `_events_v_version_backdrop_version_backdrop_phone_idx` ON `_events_v` (`version_backdrop_phone_id`)',
      'CREATE INDEX `_events_v_version_backdrop_version_backdrop_tablet_idx` ON `_events_v` (`version_backdrop_tablet_id`)',
      'CREATE INDEX `_events_v_version_backdrop_version_backdrop_desktop_idx` ON `_events_v` (`version_backdrop_desktop_id`)',
    ],
  },
  {
    table: 'payload_locked_documents_rels',
    columns: [
      '`id` integer PRIMARY KEY NOT NULL',
      '`order` integer',
      '`parent_id` integer NOT NULL',
      '`path` text NOT NULL',
      '`pages_id` integer',
      '`posts_id` integer',
      '`events_id` integer',
      '`team_members_id` integer',
      '`resources_id` integer',
      '`faq_id` integer',
      '`media_id` integer',
      '`categories_id` integer',
      '`users_id` integer',
      '`redirects_id` integer',
      '`forms_id` integer',
      '`form_submissions_id` integer',
      '`search_id` integer',
      '`payload_folders_id` integer',
      '`email_confirmations_id` integer',
      '`agent_runs_id` integer',
      '`agent_review_items_id` integer',
      '`payload_mcp_api_keys_id` integer',
      '`passkeys_id` integer',
      '`passkey_challenges_id` integer',
      '`social_link_requests_id` integer',
    ],
    keys: [
      'FOREIGN KEY (`parent_id`) REFERENCES `payload_locked_documents`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`pages_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`posts_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`events_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`team_members_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`resources_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`faq_id`) REFERENCES `faq`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`categories_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`users_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`redirects_id`) REFERENCES `redirects`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`forms_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`form_submissions_id`) REFERENCES `form_submissions`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`search_id`) REFERENCES `search`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`payload_folders_id`) REFERENCES `payload_folders`(`id`) ON UPDATE no action ON DELETE cascade',
    ],
    changed: [
      { column: 'email_confirmations_id', references: 'email_confirmations', onDelete: 'cascade' },
      { column: 'agent_runs_id', references: 'agent_runs', onDelete: 'cascade' },
      { column: 'agent_review_items_id', references: 'agent_review_items', onDelete: 'cascade' },
      {
        column: 'payload_mcp_api_keys_id',
        references: 'payload_mcp_api_keys',
        onDelete: 'cascade',
      },
      { column: 'passkeys_id', references: 'passkeys', onDelete: 'cascade' },
      { column: 'passkey_challenges_id', references: 'passkey_challenges', onDelete: 'cascade' },
      {
        column: 'social_link_requests_id',
        references: 'social_link_requests',
        onDelete: 'cascade',
      },
    ],
    indexes: [
      'CREATE INDEX `payload_locked_documents_rels_order_idx` ON `payload_locked_documents_rels` (`order`)',
      'CREATE INDEX `payload_locked_documents_rels_parent_idx` ON `payload_locked_documents_rels` (`parent_id`)',
      'CREATE INDEX `payload_locked_documents_rels_path_idx` ON `payload_locked_documents_rels` (`path`)',
      'CREATE INDEX `payload_locked_documents_rels_pages_id_idx` ON `payload_locked_documents_rels` (`pages_id`)',
      'CREATE INDEX `payload_locked_documents_rels_posts_id_idx` ON `payload_locked_documents_rels` (`posts_id`)',
      'CREATE INDEX `payload_locked_documents_rels_events_id_idx` ON `payload_locked_documents_rels` (`events_id`)',
      'CREATE INDEX `payload_locked_documents_rels_team_members_id_idx` ON `payload_locked_documents_rels` (`team_members_id`)',
      'CREATE INDEX `payload_locked_documents_rels_resources_id_idx` ON `payload_locked_documents_rels` (`resources_id`)',
      'CREATE INDEX `payload_locked_documents_rels_faq_id_idx` ON `payload_locked_documents_rels` (`faq_id`)',
      'CREATE INDEX `payload_locked_documents_rels_media_id_idx` ON `payload_locked_documents_rels` (`media_id`)',
      'CREATE INDEX `payload_locked_documents_rels_categories_id_idx` ON `payload_locked_documents_rels` (`categories_id`)',
      'CREATE INDEX `payload_locked_documents_rels_users_id_idx` ON `payload_locked_documents_rels` (`users_id`)',
      'CREATE INDEX `payload_locked_documents_rels_redirects_id_idx` ON `payload_locked_documents_rels` (`redirects_id`)',
      'CREATE INDEX `payload_locked_documents_rels_forms_id_idx` ON `payload_locked_documents_rels` (`forms_id`)',
      'CREATE INDEX `payload_locked_documents_rels_form_submissions_id_idx` ON `payload_locked_documents_rels` (`form_submissions_id`)',
      'CREATE INDEX `payload_locked_documents_rels_search_id_idx` ON `payload_locked_documents_rels` (`search_id`)',
      'CREATE INDEX `payload_locked_documents_rels_payload_folders_id_idx` ON `payload_locked_documents_rels` (`payload_folders_id`)',
      'CREATE INDEX `payload_locked_documents_rels_email_confirmations_id_idx` ON `payload_locked_documents_rels` (`email_confirmations_id`)',
      'CREATE INDEX `payload_locked_documents_rels_agent_runs_id_idx` ON `payload_locked_documents_rels` (`agent_runs_id`)',
      'CREATE INDEX `payload_locked_documents_rels_agent_review_items_id_idx` ON `payload_locked_documents_rels` (`agent_review_items_id`)',
      'CREATE INDEX `payload_locked_documents_rels_payload_mcp_api_keys_id_idx` ON `payload_locked_documents_rels` (`payload_mcp_api_keys_id`)',
      'CREATE INDEX `payload_locked_documents_rels_passkeys_id_idx` ON `payload_locked_documents_rels` (`passkeys_id`)',
      'CREATE INDEX `payload_locked_documents_rels_passkey_challenges_id_idx` ON `payload_locked_documents_rels` (`passkey_challenges_id`)',
      'CREATE INDEX `payload_locked_documents_rels_social_link_requests_id_idx` ON `payload_locked_documents_rels` (`social_link_requests_id`)',
    ],
  },
  {
    table: 'payload_preferences_rels',
    columns: [
      '`id` integer PRIMARY KEY NOT NULL',
      '`order` integer',
      '`parent_id` integer NOT NULL',
      '`path` text NOT NULL',
      '`users_id` integer',
      '`payload_mcp_api_keys_id` integer',
    ],
    keys: [
      'FOREIGN KEY (`parent_id`) REFERENCES `payload_preferences`(`id`) ON UPDATE no action ON DELETE cascade',
      'FOREIGN KEY (`users_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade',
    ],
    changed: [
      {
        column: 'payload_mcp_api_keys_id',
        references: 'payload_mcp_api_keys',
        onDelete: 'cascade',
      },
    ],
    indexes: [
      'CREATE INDEX `payload_preferences_rels_order_idx` ON `payload_preferences_rels` (`order`)',
      'CREATE INDEX `payload_preferences_rels_parent_idx` ON `payload_preferences_rels` (`parent_id`)',
      'CREATE INDEX `payload_preferences_rels_path_idx` ON `payload_preferences_rels` (`path`)',
      'CREATE INDEX `payload_preferences_rels_users_id_idx` ON `payload_preferences_rels` (`users_id`)',
      'CREATE INDEX `payload_preferences_rels_payload_mcp_api_keys_id_idx` ON `payload_preferences_rels` (`payload_mcp_api_keys_id`)',
    ],
  },
]

type Db = MigrateUpArgs['db']
type Row = Record<string, unknown>

const run = (db: Db, statement: string) => db.run(sql.raw(statement))
const rows = async (db: Db, statement: string): Promise<Row[]> =>
  ((await run(db, statement)) as { rows: Row[] }).rows
const first = async (db: Db, statement: string) => Object.values((await rows(db, statement))[0])[0]

const counts = async (db: Db) =>
  Object.fromEntries(
    await Promise.all(
      specs.map(async ({ table }) => [table, await first(db, `SELECT count(*) FROM \`${table}\``)]),
    ),
  )

/** The table with the delete rule of each changed column: the new one, or NO ACTION to go back. */
const createTable = (spec: Spec, rule: (onDelete: 'set null' | 'cascade') => string) =>
  `CREATE TABLE \`__new_${spec.table}\` (
  	${[
      ...spec.columns,
      ...spec.keys,
      ...spec.changed.map(
        (c) =>
          `FOREIGN KEY (\`${c.column}\`) REFERENCES \`${c.references}\`(\`id\`) ON UPDATE no action ON DELETE ${rule(c.onDelete)}`,
      ),
    ].join(',\n  \t')}
  );`

const columnName = (definition: string) => definition.match(/^`([^`]+)`/)![1]
const indexName = (statement: string) => statement.match(/INDEX `([^`]+)`/)![1]
const byName = (a: string, b: string) => (indexName(a) < indexName(b) ? -1 : 1)

/** What this migration knows of a column: its name, type, whether it is NOT NULL and its primary key. */
const specColumn = (definition: string) =>
  [
    columnName(definition),
    definition.split(' ')[1].toLowerCase(),
    /NOT NULL/.test(definition) ? 1 : 0,
    /PRIMARY KEY/.test(definition) ? 1 : 0,
  ].join(':')

/** Throws when a table is not the one this migration was written for: rebuilding it would drop data. */
const checkTables = async (db: Db) => {
  for (const spec of specs) {
    const columns = (
      await rows(
        db,
        `SELECT name, lower(type) AS type, "notnull", pk FROM pragma_table_info('${spec.table}')`,
      )
    ).map((row) => [row.name, row.type, row.notnull, row.pk].join(':'))
    const indexes = (
      await rows(
        db,
        `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='${spec.table}' AND sql IS NOT NULL ORDER BY name`,
      )
    ).map((row) => `${row.sql}`)
    const triggers = await rows(
      db,
      `SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='${spec.table}'`,
    )
    // Names, types and index definitions, not defaults or the rows: the live database only ever
    // changes through migrations, and a difference here means one this migration does not know
    const sameColumns = JSON.stringify(columns) === JSON.stringify(spec.columns.map(specColumn))
    const sameIndexes = JSON.stringify(indexes) === JSON.stringify([...spec.indexes].sort(byName))
    if (!sameColumns || !sameIndexes || triggers.length > 0) {
      throw new Error(`Table ${spec.table} is not as this migration expects: nothing was changed`)
    }
  }
}

const rebuild = async (db: Db, rule: (onDelete: 'set null' | 'cascade') => string) => {
  const wasOn = await first(db, 'PRAGMA foreign_keys')
  await run(db, 'PRAGMA foreign_keys=OFF;')
  try {
    // Inside a transaction the pragma silently does nothing, and the DROP below would then cascade
    if ((await first(db, 'PRAGMA foreign_keys')) !== 0) {
      throw new Error('Foreign keys could not be switched off: is this migration in a transaction?')
    }
    await run(db, 'BEGIN IMMEDIATE;')
    try {
      await checkTables(db)
      const before = await counts(db)
      const violationsBefore = (await rows(db, 'PRAGMA foreign_key_check;')).length
      for (const spec of specs) {
        const names = spec.columns.map(columnName)
        const list = names.map((n) => `"${n}"`).join(', ')
        await run(db, createTable(spec, rule))
        await run(
          db,
          `INSERT INTO \`__new_${spec.table}\`(${list}) SELECT ${list} FROM \`${spec.table}\`;`,
        )
        await run(db, `DROP TABLE \`${spec.table}\`;`)
        await run(db, `ALTER TABLE \`__new_${spec.table}\` RENAME TO \`${spec.table}\`;`)
        for (const index of spec.indexes) await run(db, `${index};`)
      }
      const after = await counts(db)
      if (JSON.stringify(after) !== JSON.stringify(before)) {
        throw new Error(`Rows changed: ${JSON.stringify(before)} became ${JSON.stringify(after)}`)
      }
      const integrity = await first(db, 'PRAGMA integrity_check;')
      if (integrity !== 'ok') throw new Error(`integrity_check failed: ${String(integrity)}`)
      if ((await rows(db, 'PRAGMA foreign_key_check;')).length > violationsBefore) {
        throw new Error('foreign_key_check found a foreign key the rebuild broke')
      }
      await run(db, 'COMMIT;')
    } catch (error) {
      await run(db, 'ROLLBACK;').catch(() => undefined)
      throw error
    }
  } finally {
    await run(db, `PRAGMA foreign_keys=${wasOn === 0 ? 'OFF' : 'ON'};`)
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await rebuild(db, (onDelete) => onDelete)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await rebuild(db, () => 'no action')
}
