import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`oauth_clients_scopes\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`oauth_clients\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`oauth_clients_scopes_order_idx\` ON \`oauth_clients_scopes\` (\`order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`oauth_clients_scopes_parent_idx\` ON \`oauth_clients_scopes\` (\`parent_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`payload_mcp_api_keys_scopes\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_mcp_api_keys\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`payload_mcp_api_keys_scopes_order_idx\` ON \`payload_mcp_api_keys_scopes\` (\`order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_mcp_api_keys_scopes_parent_idx\` ON \`payload_mcp_api_keys_scopes\` (\`parent_id\`);`,
  )
  // Keys that exist keep what they could do before scopes (Local Scout's among them): the
  // address's two scopes. Clients get read only, as a new client does: none is in use yet.
  await db.run(
    sql`INSERT INTO \`payload_mcp_api_keys_scopes\` (\`order\`, \`parent_id\`, \`value\`) SELECT 1, \`id\`, 'read' FROM \`payload_mcp_api_keys\`;`,
  )
  await db.run(
    sql`INSERT INTO \`payload_mcp_api_keys_scopes\` (\`order\`, \`parent_id\`, \`value\`) SELECT 2, \`id\`, 'suggest' FROM \`payload_mcp_api_keys\`;`,
  )
  await db.run(
    sql`INSERT INTO \`oauth_clients_scopes\` (\`order\`, \`parent_id\`, \`value\`) SELECT 1, \`id\`, 'read' FROM \`oauth_clients\`;`,
  )
  await db.run(sql`ALTER TABLE \`oauth_clients\` ADD \`expires_at\` text;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` ADD \`expires_at\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`oauth_clients_scopes\`;`)
  await db.run(sql`DROP TABLE \`payload_mcp_api_keys_scopes\`;`)
  await db.run(sql`ALTER TABLE \`oauth_clients\` DROP COLUMN \`expires_at\`;`)
  await db.run(sql`ALTER TABLE \`payload_mcp_api_keys\` DROP COLUMN \`expires_at\`;`)
}
