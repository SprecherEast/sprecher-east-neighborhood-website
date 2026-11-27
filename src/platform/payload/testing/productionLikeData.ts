import { NO_REVALIDATE, createAccount, paragraph } from './inMemoryPayload'
import { createMedia, lockDocument, withLaterColumns, type TestDatabase } from './migratedDatabase'

/**
 * A database filled the way production had it before the delete-rules migration (#1559): posts with
 * several versions and backdrops, events, a page, edit locks and preferences, rows in every table
 * that migration rebuilds.
 */

export type Snapshot = { rows: Record<string, unknown[]>; shape: Record<string, unknown> }

/** Every row of every table, in id order, and every table's columns and indexes. */
export async function snapshot(database: TestDatabase): Promise<Snapshot> {
  const tables = (
    await database.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
  ).map((table) => table.name)
  const rows: Snapshot['rows'] = {}
  const shape: Snapshot['shape'] = {}
  for (const table of tables) {
    rows[table] = await database.query(`SELECT * FROM "${table}" ORDER BY rowid`)
    shape[table] = {
      columns: await database.query(`SELECT * FROM pragma_table_info('${table}')`),
      indexes: await database.query(
        `SELECT name, sql FROM sqlite_master WHERE type IN ('index','trigger') AND tbl_name='${table}' AND sql IS NOT NULL ORDER BY name`,
      ),
    }
  }
  const { payload_migrations: _skip, ...rest } = rows
  return { rows: rest, shape }
}

export const seedLikeProduction = (database: TestDatabase): Promise<void> =>
  withLaterColumns(database, () => seed(database))

async function seed(database: TestDatabase): Promise<void> {
  const { payload } = database
  const media = (alt: string) => createMedia(database, alt)

  const editor = await createAccount(payload, 'editor', 'seed-editor')
  const [phone, tablet, desktop] = [await media('p'), await media('t'), await media('d')]
  const post = await payload.create({
    collection: 'posts',
    context: NO_REVALIDATE,
    data: {
      title: 'Spring walk',
      slug: 'spring-walk',
      content: paragraph('Join us.'),
      backdrop: { phone, tablet, desktop },
      _status: 'published',
    },
  })
  // Two more versions, one with a changed title
  for (const title of ['Spring walk 2', 'Spring walk 3']) {
    await payload.update({
      collection: 'posts',
      id: post.id,
      context: NO_REVALIDATE,
      data: { title, _status: 'published' },
    })
  }
  const event = await payload.create({
    collection: 'events',
    context: NO_REVALIDATE,
    data: {
      title: 'Picnic',
      slug: 'picnic',
      date: '2027-06-01T00:00:00.000Z',
      backdrop: { phone, desktop },
      _status: 'published',
    },
  })
  await payload.update({
    collection: 'events',
    id: event.id,
    context: NO_REVALIDATE,
    data: { title: 'Picnic 2', _status: 'published' },
  })
  await payload.create({
    collection: 'pages',
    context: NO_REVALIDATE,
    data: {
      title: 'About',
      slug: 'about',
      hero: { type: 'none' },
      layout: [{ blockType: 'cta' }],
      _status: 'published',
    },
  })
  const confirmation = await payload.db.create({
    collection: 'email-confirmations',
    data: { email: 'seed@example.com' },
  })
  const agent = await createAccount(payload, 'agent', 'seed-agent')
  const key = await payload.db.create({
    collection: 'payload-mcp-api-keys',
    data: { user: agent.id, label: 'Agent', enableAPIKey: false },
  })
  const lock = (relationTo: string, value: number) => lockDocument(database, relationTo, value)
  await lock('posts', post.id as number)
  await lock('events', event.id as number)
  await lock('email-confirmations', confirmation.id as number)
  await lock('payload-mcp-api-keys', key.id as number)
  await payload.db.create({
    collection: 'payload-preferences',
    data: { key: 'nav', user: { relationTo: 'users', value: editor.id }, value: { open: true } },
  })
  await payload.db.create({
    collection: 'payload-preferences',
    data: {
      key: 'nav',
      user: { relationTo: 'payload-mcp-api-keys', value: key.id },
      value: { a: 1 },
    },
  })
}
