import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { sql } from '@payloadcms/db-sqlite'
import { createLocalReq, type Payload } from 'payload'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { down, up } from '@/migrations/20261025_195057_shared_categories'
import { NO_REVALIDATE, bootPayload } from '@/platform/payload/testing/inMemoryPayload'
import { sqlRows } from '@/platform/payload/testing/sqlRows'

/**
 * The shared-categories migration (#362) rolls back and applies again on SQLite with foreign keys
 * enforced, each step in a transaction as `payload migrate` runs it: events keep their category
 * both ways, and posts' category links are never touched.
 */

let payload: Payload
// A file, not memory: each transaction below needs the same database (see `bootPayload`)
const folder = mkdtempSync(path.join(tmpdir(), 'shared-categories-'))
type Db = { run: (query: ReturnType<typeof sql>) => Promise<unknown> }
type Drizzle = Db & { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> }

const drizzle = () => payload.db.drizzle as unknown as Drizzle
const rows = <T>(query: ReturnType<typeof sql>) => sqlRows<T>(payload, query)
const inTransaction = async (step: typeof up | typeof down) => {
  const req = await createLocalReq({}, payload)
  await drizzle().transaction((tx) =>
    step({ db: tx, payload, req } as unknown as MigrateUpArgs & MigrateDownArgs),
  )
}
const ids: Record<string, number> = {}

beforeAll(async () => {
  ;({ payload } = await bootPayload(`file:${path.join(folder, 'test.db')}`))
  await drizzle().run(sql`PRAGMA foreign_keys = ON`)
  for (const [slug, title] of [
    ['parks', 'Parks'],
    ['social', 'Social'],
    ['meeting', 'Meeting'],
  ]) {
    ids[slug] = (await payload.create({ collection: 'categories', data: { title, slug } })).id
  }
  const event = (title: string, slug: string, categories: number[]) =>
    payload.create({
      collection: 'events',
      context: NO_REVALIDATE,
      data: { title, slug, date: '2026-11-01T00:00:00.000Z', categories, _status: 'published' },
    })
  // A new category first, then an old one: the old value comes back on rollback
  ids.both = (await event('Picnic', 'picnic', [ids.parks, ids.social])).id
  ids.meetingEvent = (await event('Council', 'council', [ids.meeting])).id
  ids.none = (await event('No category', 'none', [])).id
  ids.parksOnly = (await event('Parks only', 'parks-only', [ids.parks])).id
  ids.post = (
    await payload.create({
      collection: 'posts',
      context: NO_REVALIDATE,
      data: {
        title: 'A post',
        slug: 'a-post',
        categories: [ids.parks, ids.social],
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Hello', version: 1 }],
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            version: 1,
          },
        },
        _status: 'published',
      },
    })
  ).id
}, 60_000)

afterAll(async () => {
  await payload.destroy()
  rmSync(folder, { recursive: true, force: true })
})

const postLinks = () =>
  rows<{ n: number }>(sql`SELECT count(*) AS n FROM posts_rels WHERE path = 'categories'`)

describe('the shared-categories migration', () => {
  it('rolls back to the old column, keeping post links, then applies again', async () => {
    expect((await postLinks())[0].n).toBe(2)

    await inTransaction(down)
    const old = await rows<{ id: number; category: string | null }>(
      sql`SELECT id, category FROM events ORDER BY id`,
    )
    expect(Object.fromEntries(old.map((row) => [row.id, row.category]))).toEqual({
      [ids.both]: 'social',
      [ids.meetingEvent]: 'meeting',
      [ids.none]: null,
      [ids.parksOnly]: null,
    })
    const versions = await rows<{ parent: number; category: string | null }>(
      sql`SELECT parent_id AS parent, version_category AS category FROM _events_v WHERE latest = 1`,
    )
    expect(versions.find((row) => row.parent === ids.both)?.category).toBe('social')
    expect((await postLinks())[0].n).toBe(2)
    expect(await rows(sql`SELECT count(*) AS n FROM categories`)).toEqual([{ n: 3 }])

    await inTransaction(up)
    const links = await rows<{ parent: number; slug: string }>(
      sql`SELECT r.parent_id AS parent, c.slug AS slug FROM events_rels r
          JOIN categories c ON c.id = r.categories_id WHERE r.path = 'categories'`,
    )
    expect(links).toEqual(
      expect.arrayContaining([
        { parent: ids.both, slug: 'social' },
        { parent: ids.meetingEvent, slug: 'meeting' },
      ]),
    )
    expect(links).toHaveLength(2)
    // The existing categories were reused, not duplicated
    expect(await rows(sql`SELECT count(*) AS n FROM categories`)).toEqual([{ n: 3 }])
    expect((await postLinks())[0].n).toBe(2)
    const versionLinks = await rows<{ n: number }>(
      sql`SELECT count(*) AS n FROM _events_v_rels WHERE path = 'version.categories'`,
    )
    expect(versionLinks[0].n).toBeGreaterThanOrEqual(2)
  })
})
