import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { RELATED_LIST_LIMIT } from '@/platform/payload/relatedLimit'

import { bootPayload, NO_REVALIDATE, paragraph } from '@/platform/payload/testing/inMemoryPayload'

/**
 * Events an editor picks on a post (`posts.relatedEvents`), and the join on each event that lists
 * the posts picking it (`events.relatedPosts`, #1496). A join is virtual: nothing is stored on the
 * event. Payload runs on in-memory SQLite, with the real config, drafts and published versions.
 */

const next = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: next.revalidatePath }))
vi.mock('@/platform/payload/expireCacheTag', () => ({ expireCacheTag: vi.fn() }))

let payload: Payload
let config: SanitizedConfig

const write = { overrideAccess: true, context: NO_REVALIDATE } as const

const createEvent = (slug: string, status: 'draft' | 'published' = 'published') =>
  payload.create({
    collection: 'events',
    data: { title: slug, slug, date: '2027-03-01T00:00:00.000Z', _status: status },
    ...write,
  })

const createPost = async (
  slug: string,
  relatedEvents: number[],
  status: 'draft' | 'published' = 'published',
) => {
  const post = await payload.create({
    collection: 'posts',
    data: {
      title: slug,
      slug,
      content: paragraph('News.'),
      publishedAt: '2026-10-01T12:00:00.000Z',
      relatedEvents,
      _status: status,
    },
    ...write,
  })
  slugById.set(post.id, slug)
  return post
}

/** The slugs by id of the posts made here, since the join answers with ids only (`maxDepth: 0`). */
const slugById = new Map<number, string>()

/** The slugs of the posts an event's join lists, read as a visitor does. */
async function joinedPostSlugs(eventId: number, overrideAccess = false): Promise<string[]> {
  const event = await payload.findByID({
    collection: 'events',
    id: eventId,
    depth: 1,
    overrideAccess,
    joins: { relatedPosts: { limit: 20 } },
  })
  const docs = event.relatedPosts?.docs ?? []
  return docs.map((doc) => slugById.get(typeof doc === 'object' ? doc.id : doc) ?? '?').sort()
}

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
}, 60_000)

describe('posts.relatedEvents', () => {
  it('stores several events, in the order the editor picked them', async () => {
    const first = await createEvent('walk-a')
    const second = await createEvent('walk-b')
    const post = await createPost('walks-recap', [second.id, first.id])

    const stored = await payload.findByID({ collection: 'posts', id: post.id, depth: 0, ...write })
    expect(stored.relatedEvents).toEqual([second.id, first.id])

    const loaded = await payload.findByID({ collection: 'posts', id: post.id, depth: 1, ...write })
    const titles = (loaded.relatedEvents ?? []).map((e) => (typeof e === 'object' ? e.title : ''))
    expect(titles).toEqual(['walk-b', 'walk-a'])
  })

  it('offers only published events in the picker', async () => {
    const posts = config.collections.find((c) => c.slug === 'posts')
    const field = posts?.fields
      .flatMap((f) => (f.type === 'tabs' ? f.tabs.flatMap((t) => t.fields) : [f]))
      .find((f) => 'name' in f && f.name === 'relatedEvents')
    if (!field || field.type !== 'relationship') throw new Error('relatedEvents is not a field')

    expect(field.relationTo).toBe('events')
    expect(field.hasMany).toBe(true)
    const options = field.filterOptions
    expect(typeof options === 'function' ? await options({} as never) : options).toEqual({
      _status: { equals: 'published' },
    })
  })
})

describe('the picker on a post', () => {
  const field = () => {
    const posts = config.collections.find((c) => c.slug === 'posts')
    return posts?.flattenedFields.find((f) => f.name === 'relatedEvents') as unknown as {
      maxRows?: number
      admin: { description?: string; appearance?: string; sortOptions?: string }
    }
  }

  it('takes at most as many events as an event page lists posts', async () => {
    expect(field().maxRows).toBe(RELATED_LIST_LIMIT)
    const events = await Promise.all(
      Array.from({ length: RELATED_LIST_LIMIT + 1 }, (_, i) => createEvent(`cap-event-${i}`)),
    )
    await expect(
      createPost(
        'too-many-picks',
        events.map((e) => e.id),
      ),
    ).rejects.toThrow()
    await expect(
      createPost(
        'enough-picks',
        events.slice(0, RELATED_LIST_LIMIT).map((e) => e.id),
      ),
    ).resolves.toBeDefined()
  })

  it('tells editors what it is for, lists events with their dates and says to drop an unpublished one', () => {
    const { description, appearance, sortOptions } = field().admin
    expect(description).toMatch(/unpublished/)
    expect(appearance).toBe('drawer')
    expect(sortOptions).toBe('-date')
  })
})

describe('events.relatedPosts (join)', () => {
  it('lists the published posts that pick the event, on every event they pick', async () => {
    const a = await createEvent('join-a')
    const b = await createEvent('join-b')
    await createPost('join-both', [a.id, b.id])
    await createPost('join-only-a', [a.id])

    expect(await joinedPostSlugs(a.id)).toEqual(['join-both', 'join-only-a'])
    expect(await joinedPostSlugs(b.id)).toEqual(['join-both'])
  })

  it('keeps nothing on the event itself', async () => {
    const columns = await (payload.db as unknown as SQLiteAdapter).client.execute(
      'PRAGMA table_info(events)',
    )
    const names = columns.rows.map((row) => String(row.name))
    expect(names).toContain('title')
    expect(names.filter((name) => name.includes('related'))).toEqual([])
  })

  it('leaves out a post that was never published', async () => {
    const event = await createEvent('join-draft')
    await createPost('join-draft-post', [event.id], 'draft')
    expect(await joinedPostSlugs(event.id)).toEqual([])
    expect(await joinedPostSlugs(event.id, true)).toEqual([])
  })

  it('leaves out a post that was unpublished, and lists it again once published', async () => {
    const event = await createEvent('join-unpublish')
    const post = await createPost('join-unpublish-post', [event.id])
    expect(await joinedPostSlugs(event.id)).toEqual(['join-unpublish-post'])

    await payload.update({
      collection: 'posts',
      id: post.id,
      data: { _status: 'draft' },
      ...write,
    })
    expect(await joinedPostSlugs(event.id)).toEqual([])

    await payload.update({
      collection: 'posts',
      id: post.id,
      data: { _status: 'published' },
      ...write,
    })
    expect(await joinedPostSlugs(event.id)).toEqual(['join-unpublish-post'])
  })

  it('follows the published version, not a later draft of the post', async () => {
    const kept = await createEvent('join-kept')
    const dropped = await createEvent('join-dropped')
    const post = await createPost('join-versions', [kept.id])

    // A draft save moves the link only in the draft: visitors still see the published one
    await payload.update({
      collection: 'posts',
      id: post.id,
      data: { relatedEvents: [dropped.id] },
      draft: true,
      ...write,
    })
    expect(await joinedPostSlugs(kept.id)).toEqual(['join-versions'])
    expect(await joinedPostSlugs(dropped.id)).toEqual([])

    await payload.update({
      collection: 'posts',
      id: post.id,
      data: { relatedEvents: [dropped.id], _status: 'published' },
      ...write,
    })
    expect(await joinedPostSlugs(kept.id)).toEqual([])
    expect(await joinedPostSlugs(dropped.id)).toEqual(['join-versions'])
  })
})

// With the refresh hooks on, as in production: a delete reads the other side before the rows go
describe('deleting a post or an event that the other side shows', () => {
  const refreshed = () => next.revalidatePath.mock.calls.map(([path]) => path as string)

  it('refreshes the pages of the posts that picked a deleted event', async () => {
    const event = await createEvent('doomed-event')
    await createPost('picks-doomed-event', [event.id])
    next.revalidatePath.mockClear()

    await payload.delete({ collection: 'events', id: event.id, overrideAccess: true })

    expect(refreshed()).toEqual(
      expect.arrayContaining(['/events/doomed-event', '/posts/picks-doomed-event']),
    )
  })

  it('refreshes the pages of the events a deleted post picked', async () => {
    const event = await createEvent('lonely-event')
    const post = await createPost('doomed-post', [event.id])
    next.revalidatePath.mockClear()

    await payload.delete({ collection: 'posts', id: post.id, overrideAccess: true })

    expect(refreshed()).toEqual(
      expect.arrayContaining(['/posts/doomed-post', '/events/lonely-event']),
    )
  })
})
