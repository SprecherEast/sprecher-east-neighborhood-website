import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { parseCursor } from '@/platform/lib'
import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'
import { expectEveryItemOnce, readListing } from '@/platform/payload/testing/readListing'

import type * as Queries from './queries'

import type { EventScope } from '../domain/scope'

/**
 * "Load more" on /events pages by cursor, not by offset (#125): content that changes between two
 * loads skips and repeats nothing else, in both listings. Payload runs on in-memory SQLite.
 */

let payload: Payload
let queries: typeof Queries

const TODAY = '2026-06-15T00:00:00.000Z'
const DAY_MS = 86_400_000
const day = (offset: number) => new Date(Date.parse(TODAY) + offset * DAY_MS).toISOString()

// 22 upcoming events (12 a page): six share day +10, at positions 10 to 15, across the end of
// page 1. 22 past events (9 a page): six share day -8, at positions 7 to 12, across page 1's end.
// Each list also holds an event one day outside the other (day 0 is upcoming, day -1 is past).
const UPCOMING_DAYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, ...Array(6).fill(10), 11, 12, 13, 14, 15, 16, 17]
const PAST_DAYS = [-1, -2, -3, -4, -5, -6, ...Array(6).fill(-8), -9, -10, -11, -12, -13, -14, -15]
  .concat([-16, -17, -18])

// Drafts that stay drafts, where the loads after page 1 run: on a shared day and on its own
const DRAFT_DAYS = [10, 13, -8, -13]

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('./queries')
}, 60_000)

let created = 0

async function createEvent(title: string, date: string, published = true) {
  created += 1
  return payload.create({
    collection: 'events',
    data: { title, slug: `event-${created}`, date, _status: published ? 'published' : 'draft' },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
}

beforeEach(async () => {
  await payload.delete({
    collection: 'events',
    where: { id: { exists: true } },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
  // Created in shuffled order, so ids don't follow dates
  const days = [...UPCOMING_DAYS, ...PAST_DAYS]
  for (const [index, offset] of days.entries()) {
    const shuffled = days[(index * 7) % days.length] ?? offset
    await createEvent(`Event ${index}`, day(shuffled))
  }
  for (const offset of DRAFT_DAYS) await createEvent(`Draft on day ${offset}`, day(offset), false)
}, 60_000)

/** What the listing holds now, in its order: the whole truth the reader should end up with. */
async function listingNow(scope: EventScope, today = TODAY) {
  const { docs } = await payload.find({
    collection: 'events',
    pagination: false,
    sort: scope === 'upcoming' ? ['date', 'id'] : ['-date', '-id'],
    where: {
      and: [
        { _status: { equals: 'published' } },
        scope === 'upcoming' ? { date: { greater_than_equal: today } } : { date: { less_than: today } },
      ],
    },
    select: {},
    overrideAccess: true,
  })
  return docs.map((doc) => doc.id)
}

/** Reads the listing as a visitor, running `between` while page 1 is on screen. */
function read(
  scope: EventScope,
  between?: (onScreen: number[]) => Promise<void>,
  todayLater = TODAY,
) {
  return readListing({
    first: () => queries.findEventPage(scope, 1, TODAY),
    after: (cursor) => {
      const parsed = parseCursor(cursor)
      if (!parsed) throw new Error(`The server returned a bad cursor: ${cursor}`)
      return queries.findEventsAfter(scope, parsed, todayLater)
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

const update = (id: number, data: Record<string, unknown>) =>
  payload.update({ collection: 'events', id, data, overrideAccess: true, context: NO_REVALIDATE })

describe.each<EventScope>(['upcoming', 'past'])('the %s events listing', (scope) => {
  const later = scope === 'upcoming' ? day(60) : day(-60)

  it('has at least 20 events, so it takes several loads', async () => {
    expect((await listingNow(scope)).length).toBeGreaterThanOrEqual(20)
  })

  it('shows events on the same day across a page boundary exactly once', async () => {
    const first = await queries.findEventPage(scope, 1, TODAY)
    const cursor = parseCursor(first.nextCursor)
    if (!cursor) throw new Error('Page 1 should have a next cursor')
    const second = await queries.findEventsAfter(scope, cursor, TODAY)
    // The shared day really spans the boundary
    expect(first.docs.at(-1)?.date).toBe(second.docs[0]?.date)

    expectEveryItemOnce(await read(scope), await listingNow(scope))
  })

  it('loads only its own published events after a cursor from outside the list', async () => {
    // A forged cursor dated a month into the other list: the scope still holds
    const outside = { key: scope === 'upcoming' ? day(-30) : day(30), id: 1 }
    const { docs } = await queries.findEventsAfter(scope, outside, TODAY)
    const listing = await listingNow(scope)

    expect(docs.length).toBeGreaterThan(0)
    expect(docs.map((doc) => doc.id)).toEqual(listing.slice(0, docs.length))
  })

  it.each<[string, (onScreen: number[]) => Promise<number>]>([
    [
      'unpublishing an event on screen',
      async (onScreen) => (await update(onScreenAt(onScreen, 2), { _status: 'draft' })).id,
    ],
    [
      'deleting an event on screen',
      async (onScreen) =>
        (
          await payload.delete({
            collection: 'events',
            id: onScreenAt(onScreen, 2),
            overrideAccess: true,
            context: NO_REVALIDATE,
          })
        ).id,
    ],
    [
      're-dating an event on screen to later in the list',
      async (onScreen) => (await update(onScreenAt(onScreen, 1), { date: later })).id,
    ],
    [
      'publishing a new event among those not loaded yet',
      async () => (await createEvent('New', scope === 'upcoming' ? day(15) : day(-15))).id,
    ],
    [
      'publishing a new event among those on screen',
      async () => (await createEvent('New', scope === 'upcoming' ? day(1) : day(-1))).id,
    ],
    [
      'publishing a draft',
      async () => {
        const draft = await createEvent('Draft', scope === 'upcoming' ? day(13) : day(-13), false)
        return (await update(draft.id, { _status: 'published' })).id
      },
    ],
  ])('skips and repeats nothing else after %s', async (_label, change) => {
    let changed: number | undefined
    const seen = await read(scope, async (onScreen) => {
      changed = await change(onScreen)
    })
    expectEveryItemOnce(seen, await listingNow(scope), changed)
  })
})

it('skips nothing when upcoming events become past at midnight between loads', async () => {
  const tomorrow = day(1)
  const seen = await read('upcoming', undefined, tomorrow)
  // Today's events are already on screen and leave the list; the rest all come, once each
  expectEveryItemOnce(seen, await listingNow('upcoming', tomorrow))
  expect(seen.ids.slice(12)).toEqual((await listingNow('upcoming', tomorrow)).slice(11))
})
