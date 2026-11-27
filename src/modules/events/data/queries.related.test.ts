import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, NO_REVALIDATE, paragraph } from '@/platform/payload/testing/inMemoryPayload'

import { RELATED_LIST_LIMIT } from '@/platform/payload/relatedLimit'

import type * as Queries from './queries'

/**
 * What the event page and the post page ask of the events (#1496): the posts that pick an event,
 * the events a post picks, and the upcoming list without them. Payload runs on in-memory SQLite.
 */

let payload: Payload
let queries: typeof Queries

const write = { overrideAccess: true, context: NO_REVALIDATE } as const
const TODAY = '2027-03-01T00:00:00.000Z'

const createEvent = (slug: string, date: string, status: 'draft' | 'published' = 'published') =>
  payload.create({
    collection: 'events',
    data: { title: slug, slug, date, _status: status },
    ...write,
  })

const createPost = (
  slug: string,
  publishedAt: string,
  relatedEvents: number[],
  status: 'draft' | 'published' = 'published',
) =>
  payload.create({
    collection: 'posts',
    data: {
      title: slug,
      slug,
      content: paragraph('News.'),
      publishedAt,
      relatedEvents,
      _status: status,
    },
    ...write,
  })

let past: Awaited<ReturnType<typeof createEvent>>
let soon: Awaited<ReturnType<typeof createEvent>>
let later: Awaited<ReturnType<typeof createEvent>>
let hidden: Awaited<ReturnType<typeof createEvent>>
let postIds: Record<string, number>

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('./queries')

  past = await createEvent('past-walk', '2027-01-10T00:00:00.000Z')
  soon = await createEvent('soon-walk', '2027-03-05T00:00:00.000Z')
  later = await createEvent('later-walk', '2027-04-05T00:00:00.000Z')
  hidden = await createEvent('hidden-walk', '2027-03-06T00:00:00.000Z', 'draft')

  const older = await createPost('older-recap', '2027-01-11T12:00:00.000Z', [past.id, soon.id])
  const newer = await createPost('newer-recap', '2027-02-11T12:00:00.000Z', [soon.id])
  const draft = await createPost('draft-recap', '2027-02-12T12:00:00.000Z', [soon.id], 'draft')
  postIds = { older: older.id, newer: newer.id, draft: draft.id }
}, 60_000)

describe('the posts that pick an event', () => {
  it('are named on the event page, published only and newest first', async () => {
    const event = await queries.getEventBySlug('soon-walk', { draft: false })
    expect(event?.relatedPostIds).toEqual([postIds.newer, postIds.older])
  })

  it('are none when no post picks the event', async () => {
    const event = await queries.getEventBySlug('later-walk', { draft: false })
    expect(event?.relatedPostIds).toEqual([])
  })

  it('are still named for an editor previewing the event’s draft, whose list the page filters again', async () => {
    const event = await queries.getEventBySlug('soon-walk', { draft: true })
    expect(event?.relatedPostIds).toEqual(expect.arrayContaining([postIds.newer, postIds.older]))
  })
})

describe('findEventsByIds', () => {
  it('lists the published events in the order they were picked, past ones included', async () => {
    const events = await queries.findEventsByIds([later.id, past.id, soon.id])
    expect(events.map((e) => e.slug)).toEqual(['later-walk', 'past-walk', 'soon-walk'])
  })

  it('leaves out a draft event, and answers at once for no picks', async () => {
    const events = await queries.findEventsByIds([hidden.id, soon.id, 99999])
    expect(events.map((e) => e.slug)).toEqual(['soon-walk'])
    expect(await queries.findEventsByIds([])).toEqual([])
  })
})

describe('findUpcomingEvents', () => {
  it('leaves out the events it is told not to list', async () => {
    const all = await queries.findUpcomingEvents({ today: TODAY, limit: 10 })
    expect(all.map((e) => e.slug)).toEqual(['soon-walk', 'later-walk'])

    const some = await queries.findUpcomingEvents({
      today: TODAY,
      limit: 10,
      excludeIds: [soon.id, past.id],
    })
    expect(some.map((e) => e.slug)).toEqual(['later-walk'])
  })
})

// Last, so the event it adds doesn't change the upcoming list above
describe('a cancelled event a post picks', () => {
  it('stays on the post, marked cancelled, like everywhere else on the site', async () => {
    const called = await payload.create({
      collection: 'events',
      data: {
        title: 'called-off',
        slug: 'called-off',
        date: '2027-03-09T00:00:00.000Z',
        cancelled: true,
        _status: 'published',
      },
      ...write,
    })
    const events = await queries.findEventsByIds([called.id])
    expect(events.map((e) => [e.slug, e.cancelled])).toEqual([['called-off', true]])
  })
})

// Last, so the posts it adds don't change the lists above
describe('an event that many posts pick', () => {
  it('names at most the limit of its newest posts, however many pick it', async () => {
    const popular = await createEvent('popular-walk', '2027-05-01T00:00:00.000Z')
    for (let i = 0; i < RELATED_LIST_LIMIT + 2; i += 1) {
      await createPost(`popular-recap-${i}`, `2027-04-${String(10 + i).padStart(2, '0')}T12:00:00.000Z`, [
        popular.id,
      ])
    }
    const event = await queries.getEventBySlug('popular-walk', { draft: false })
    expect(event?.relatedPostIds).toHaveLength(RELATED_LIST_LIMIT)
  })
})
