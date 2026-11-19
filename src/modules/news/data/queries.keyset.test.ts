import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { parseCursor } from '@/platform/lib'
import { bootPayload, NO_REVALIDATE, paragraph } from '@/platform/payload/testing/inMemoryPayload'
import { expectEveryItemOnce, readListing } from '@/platform/payload/testing/readListing'

import type * as Queries from './queries'

/**
 * "Load more" on /posts pages by cursor, not by offset (#125): posts that change between two
 * loads skip and repeat nothing else. Payload runs on in-memory SQLite.
 */

let payload: Payload
let queries: typeof Queries

const NOW = Date.parse('2026-06-15T12:00:00.000Z')
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()

// 22 posts (12 a page), newest first: six share one time, at positions 10 to 15, across the end
// of page 1
const HOURS_AGO = [1, 2, 3, 4, 5, 6, 7, 8, 9, ...Array(6).fill(10), 11, 12, 13, 14, 15, 16, 17]

// Drafts that stay drafts, where the loads after page 1 run: at a shared time and on their own
const DRAFT_HOURS_AGO = [10, 13]

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('./queries')
}, 60_000)

let created = 0

async function createPost(publishedAt: string, published = true) {
  created += 1
  return payload.create({
    collection: 'posts',
    data: {
      title: `Post ${created}`,
      slug: `post-${created}`,
      content: paragraph('News.'),
      publishedAt,
      _status: published ? 'published' : 'draft',
    },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
}

const update = (id: number, data: Record<string, unknown>) =>
  payload.update({ collection: 'posts', id, data, overrideAccess: true, context: NO_REVALIDATE })

beforeEach(async () => {
  await payload.delete({
    collection: 'posts',
    where: { id: { exists: true } },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
  // Created in shuffled order, so ids don't follow dates
  for (const index of HOURS_AGO.keys()) {
    await createPost(hoursAgo(HOURS_AGO[(index * 5) % HOURS_AGO.length] ?? 0))
  }
  for (const hours of DRAFT_HOURS_AGO) await createPost(hoursAgo(hours), false)
}, 60_000)

/** What the listing holds now, in its order: the whole truth the reader should end up with. */
async function listingNow() {
  const { docs } = await payload.find({
    collection: 'posts',
    pagination: false,
    sort: ['-publishedAt', '-id'],
    where: { _status: { equals: 'published' } },
    select: { publishedAt: true },
    overrideAccess: true,
  })
  // SQLite sorts posts without a date last when newest come first
  return [...docs.filter((doc) => doc.publishedAt), ...docs.filter((doc) => !doc.publishedAt)].map(
    (doc) => doc.id,
  )
}

/** Reads the listing as a visitor, running `between` while page 1 is on screen. */
function read(between?: (onScreen: number[]) => Promise<void>) {
  return readListing({
    first: () => queries.findPostPage(1),
    after: (cursor) => {
      const parsed = parseCursor(cursor)
      if (!parsed) throw new Error(`The server returned a bad cursor: ${cursor}`)
      return queries.findPostsAfter(parsed)
    },
    between,
  })
}

/** The id at `index` on screen. */
function onScreenAt(onScreen: number[], index: number): number {
  const id = onScreen[index]
  if (id === undefined) throw new Error(`Nothing at position ${index} on screen`)
  return id
}

describe('the news listing', () => {
  it('has at least 20 posts, so it takes several loads', async () => {
    expect((await listingNow()).length).toBeGreaterThanOrEqual(20)
  })

  it('shows posts published at the same time across a page boundary exactly once', async () => {
    const first = await queries.findPostPage(1)
    const cursor = parseCursor(first.nextCursor)
    if (!cursor) throw new Error('Page 1 should have a next cursor')
    const second = await queries.findPostsAfter(cursor)
    // The shared time really spans the boundary
    expect(first.docs.at(-1)?.publishedAt).toBe(second.docs[0]?.publishedAt)

    expectEveryItemOnce(await read(), await listingNow())
  })

  it('shows a published post without a date once, at the end', async () => {
    const post = await createPost(hoursAgo(3))
    // Stored without a date, as content written straight to the database can be
    await payload.db.updateOne({ collection: 'posts', id: post.id, data: { publishedAt: null } })

    const seen = await read()
    expectEveryItemOnce(seen, await listingNow())
    expect(seen.ids.at(-1)).toBe(post.id)
  })

  it('shows posts without a date across a page boundary exactly once', async () => {
    // The 11 oldest lose their date, so page 1 ends on one of them and the cursor has no date
    for (const id of (await listingNow()).slice(-11)) {
      await payload.db.updateOne({ collection: 'posts', id, data: { publishedAt: null } })
    }
    const first = await queries.findPostPage(1)
    expect(parseCursor(first.nextCursor)?.key).toBeNull()

    expectEveryItemOnce(await read(), await listingNow())
  })

  it.each<[string, (onScreen: number[]) => Promise<number>]>([
    [
      'unpublishing a post on screen',
      async (onScreen) => (await update(onScreenAt(onScreen, 2), { _status: 'draft' })).id,
    ],
    [
      'deleting a post on screen',
      async (onScreen) =>
        (
          await payload.delete({
            collection: 'posts',
            id: onScreenAt(onScreen, 2),
            overrideAccess: true,
            context: NO_REVALIDATE,
          })
        ).id,
    ],
    [
      're-dating a post on screen to later in the list',
      async (onScreen) =>
        (await update(onScreenAt(onScreen, 1), { publishedAt: hoursAgo(100) })).id,
    ],
    [
      'publishing a new post among those on screen',
      async () => (await createPost(hoursAgo(2))).id,
    ],
    [
      'publishing a new post among those not loaded yet',
      async () => (await createPost(hoursAgo(15))).id,
    ],
    [
      'publishing a draft',
      async () => {
        const draft = await createPost(hoursAgo(13), false)
        return (await update(draft.id, { _status: 'published' })).id
      },
    ],
  ])('skips and repeats nothing else after %s', async (_label, change) => {
    let changed: number | undefined
    const seen = await read(async (onScreen) => {
      changed = await change(onScreen)
    })
    expectEveryItemOnce(seen, await listingNow(), changed)
  })
})
