import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
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

const OAUTH_LOCK_COLUMNS = ['oauth_clients_id', 'oauth_tokens_id']
const isOAuthLock = (name: string) => OAUTH_LOCK_COLUMNS.some((column) => name.includes(column))

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Under foreign-key enforcement nothing may still point at the tables this drops, and SQLite
  // ignores PRAGMA foreign_keys inside the migration's transaction. So, in order: forget edit
  // locks that point at a client or a token (their rel rows go with them), rebuild the edit-lock
  // rels table without those two columns, then drop the tables, tokens before the clients they
  // point at. The rebuild keeps the table exactly as the database has it, read from the database
  // itself (columns in order, every other key with the rule it has, every other index), so it
  // leaves what the migration before this one (#1559) left and that one can still be rolled back.
  const rows = async (statement: string) =>
    ((await db.run(sql.raw(statement))) as { rows: Record<string, string>[] }).rows
  const table = 'payload_locked_documents_rels'
  await db.run(
    sql`DELETE FROM \`payload_locked_documents\` WHERE \`id\` IN (SELECT \`parent_id\` FROM \`payload_locked_documents_rels\` WHERE \`oauth_clients_id\` IS NOT NULL OR \`oauth_tokens_id\` IS NOT NULL);`,
  )
  const [{ sql: createSql }] = await rows(`SELECT sql FROM sqlite_master WHERE name = '${table}'`)
  // ALTER TABLE ADD COLUMN appended the two columns, each with its key, to the end of the text
  const rebuilt = OAUTH_LOCK_COLUMNS.reduce(
    (text, column) =>
      text.replace(new RegExp(`,\\s*\`${column}\` integer REFERENCES [^,)]*\\([^)]*\\)[^,)]*`), ''),
    createSql,
  ).replace(new RegExp(`^CREATE TABLE [\`"]${table}[\`"]`), `CREATE TABLE \`__new_${table}\``)
  if (/oauth_/.test(rebuilt)) throw new Error(`Table ${table} is not as this migration expects`)
  const indexes = (
    await rows(
      `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = '${table}' AND sql IS NOT NULL`,
    )
  ).filter(({ name }) => !isOAuthLock(name))
  const keep = (await rows(`SELECT name FROM pragma_table_info('${table}')`))
    .map(({ name }) => name)
    .filter((name) => !isOAuthLock(name))
    .map((name) => `"${name}"`)
    .join(', ')
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql.raw(rebuilt))
  await db.run(sql.raw(`INSERT INTO \`__new_${table}\`(${keep}) SELECT ${keep} FROM \`${table}\`;`))
  await db.run(sql.raw(`DROP TABLE \`${table}\`;`))
  await db.run(sql.raw(`ALTER TABLE \`__new_${table}\` RENAME TO \`${table}\`;`))
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`DROP TABLE \`oauth_tokens\`;`)
  await db.run(sql`DROP TABLE \`oauth_clients_redirect_uris\`;`)
  await db.run(sql`DROP TABLE \`oauth_clients\`;`)
  for (const { sql: statement } of indexes) await db.run(sql.raw(`${statement};`))
}
