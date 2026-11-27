import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RETENTION_QUEUE } from '@/platform/payload/retentionJobs'
import { createAccount, paragraph } from '@/platform/payload/testing/inMemoryPayload'
import {
  createMigratedDatabase,
  type TestDatabase,
} from '@/platform/payload/testing/migratedDatabase'

/**
 * Deletes that must work on a database built by the real migrations (#1559): a media file used as
 * a title band photo, and a document that an editor has open (an edit lock row), which the
 * retention jobs delete too.
 */

let database: TestDatabase
const ctx = { disableRevalidate: true }
const count = async (statement: string) => (await database.query(statement)).length

beforeAll(async () => {
  database = await createMigratedDatabase()
}, 180_000)

afterAll(async () => {
  await database?.cleanup()
})

/** A media row, written the way the database sees it: no file on disk. */
const media = async (alt: string) =>
  (
    await database.payload.db.create({
      collection: 'media',
      data: { alt, filename: `${alt}.png`, mimeType: 'image/png' },
    })
  ).id as number

describe('deleting a media file used as a backdrop', () => {
  it('empties the title band photo of a post and its versions', async () => {
    const { payload } = database
    const [phone, tablet, desktop] = [await media('a'), await media('b'), await media('c')]
    const post = await payload.create({
      collection: 'posts',
      context: ctx,
      data: {
        title: 'Walk',
        slug: 'walk-post',
        content: paragraph('News.'),
        backdrop: { phone, tablet, desktop },
        _status: 'published',
      },
    })
    await payload.update({
      collection: 'posts',
      id: post.id,
      context: ctx,
      data: { title: 'Walk 2', _status: 'published' },
    })
    expect(await count('SELECT 1 FROM _posts_v WHERE version_backdrop_phone_id IS NOT NULL')).toBe(
      2,
    )

    for (const id of [phone, tablet, desktop]) await payload.delete({ collection: 'media', id })

    const kept = await payload.findByID({ collection: 'posts', id: post.id, depth: 0 })
    expect(kept.backdrop).toEqual({ phone: null, tablet: null, desktop: null })
    expect(await count('SELECT 1 FROM posts WHERE backdrop_phone_id IS NOT NULL')).toBe(0)
    expect(
      await count('SELECT 1 FROM _posts_v WHERE version_backdrop_desktop_id IS NOT NULL'),
    ).toBe(0)
  })

  it('empties the title band photo of an event and its versions', async () => {
    const { payload } = database
    const [phone, tablet, desktop] = [await media('d'), await media('e'), await media('f')]
    const event = await payload.create({
      collection: 'events',
      context: ctx,
      data: {
        title: 'Fair',
        slug: 'fair-event',
        date: '2027-04-01T00:00:00.000Z',
        backdrop: { phone, tablet, desktop },
        _status: 'published',
      },
    })

    for (const id of [phone, tablet, desktop]) await payload.delete({ collection: 'media', id })

    const kept = await payload.findByID({ collection: 'events', id: event.id, depth: 0 })
    expect(kept.backdrop).toEqual({ phone: null, tablet: null, desktop: null })
    expect(await count('SELECT 1 FROM _events_v WHERE version_backdrop_phone_id IS NOT NULL')).toBe(
      0,
    )
  })

  it('empties the backdrop of a page', async () => {
    const { payload } = database
    const backdrop = await media('g')
    const page = await payload.create({
      collection: 'pages',
      context: ctx,
      data: {
        title: 'About',
        slug: 'about-page',
        hero: { type: 'none' },
        layout: [{ blockType: 'cta' }],
        backdrop,
        _status: 'published',
      },
    })

    await payload.delete({ collection: 'media', id: backdrop })

    expect((await payload.findByID({ collection: 'pages', id: page.id, depth: 0 })).backdrop).toBe(
      null,
    )
  })
})

describe('deleting a document an editor has open', () => {
  let editor: Awaited<ReturnType<typeof createAccount>> | undefined
  const lock = async (relationTo: string, id: number) => {
    const { payload } = database
    editor ??= await createAccount(payload, 'editor', 'lock-holder')
    await payload.db.create({
      collection: 'payload-locked-documents',
      data: {
        document: { relationTo, value: id },
        globalSlug: null,
        user: { relationTo: 'users', value: editor.id },
      },
    })
    expect(
      await count(
        `SELECT 1 FROM payload_locked_documents_rels WHERE ${relationTo.replace(/-/g, '_')}_id = ${id}`,
      ),
    ).toBe(1)
  }

  it('works for an email confirmation, a collection added by a later migration', async () => {
    const { payload } = database
    const row = await payload.db.create({
      collection: 'email-confirmations',
      data: { email: 'locked@example.com' },
    })
    await lock('email-confirmations', row.id as number)

    await payload.delete({ collection: 'email-confirmations', id: row.id as number })

    expect(
      await count(
        'SELECT 1 FROM payload_locked_documents_rels WHERE email_confirmations_id IS NOT NULL',
      ),
    ).toBe(0)
  })

  it('works for an MCP key that also has a preference row', async () => {
    const { payload } = database
    const agent = await createAccount(payload, 'agent', 'mcp-agent')
    const key = await payload.db.create({
      collection: 'payload-mcp-api-keys',
      data: { user: agent.id, label: 'Agent', enableAPIKey: false },
    })
    await lock('payload-mcp-api-keys', key.id as number)
    await payload.db.create({
      collection: 'payload-preferences',
      data: {
        key: 'nav',
        user: { relationTo: 'payload-mcp-api-keys', value: key.id },
        value: { open: true },
      },
    })

    await payload.delete({ collection: 'payload-mcp-api-keys', id: key.id as number })

    expect(
      await count(
        'SELECT 1 FROM payload_preferences_rels WHERE payload_mcp_api_keys_id IS NOT NULL',
      ),
    ).toBe(0)
  })

  it('works for the retention job that deletes an expired email confirmation with a lock', async () => {
    const { payload } = database
    const row = await payload.db.create({
      collection: 'email-confirmations',
      data: { email: 'expired@example.com', lastSentAt: '2020-01-01T00:00:00.000Z' },
    })
    await lock('email-confirmations', row.id as number)

    await payload.jobs.queue({
      task: 'deleteExpiredEmailConfirmations',
      queue: RETENTION_QUEUE,
      input: {},
    })
    await payload.jobs.run({ queue: RETENTION_QUEUE })

    expect(await count(`SELECT 1 FROM email_confirmations WHERE id = ${row.id}`)).toBe(0)
    expect(await count('SELECT 1 FROM payload_jobs WHERE has_error = 1')).toBe(0)
  })
})
