import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { parseCursor } from '@/platform/lib'
import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'
import { expectEveryItemOnce, readListing } from '@/platform/payload/testing/readListing'

import type * as Categories from './categories'
import type * as Queries from './queries'

import type { EventScope } from '../domain/scope'

/**
 * Filtering /events by category (#122) on in-memory SQLite: the filter row offers the categories
 * with published events and counts them right, and a filtered listing, "Load more" included,
 * holds exactly that category's published events, skipping and leaking none.
 */

let payload: Payload
let queries: typeof Queries
let categories: typeof Categories

const TODAY = '2026-06-15T00:00:00.000Z'
const DAY_MS = 86_400_000
const day = (offset: number) => new Date(Date.parse(TODAY) + offset * DAY_MS).toISOString()

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('./queries')
  categories = await import('./categories')
}, 60_000)

const ids: Record<'civic' | 'parks' | 'family' | 'unused', number> = {
  civic: 0,
  parks: 0,
  family: 0,
  unused: 0,
}
let created = 0

async function createEvent(date: string, categoryIds: number[], published = true) {
  created += 1
  return payload.create({
    collection: 'events',
    data: {
      title: `Event ${created}`,
      slug: `event-${created}`,
      date,
      categories: categoryIds,
      _status: published ? 'published' : 'draft',
    },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
}

beforeEach(async () => {
  for (const collection of ['events', 'categories'] as const) {
    await payload.delete({
      collection,
      where: { id: { exists: true } },
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
  }
  // "Parks" is created first, so the row's title order isn't the creation order
  for (const [key, title] of [
    ['parks', 'Parks'],
    ['civic', 'Civic'],
    ['family', 'Family'],
    ['unused', 'Unused'],
  ] as const) {
    const category = await payload.create({
      collection: 'categories',
      data: { title, slug: key },
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
    ids[key] = category.id
  }

  // Civic: 15 upcoming (12 a page) and 11 past (9 a page), some on shared days, some also Parks
  for (let i = 0; i < 15; i++) {
    await createEvent(day(Math.floor(i / 2)), i % 4 === 0 ? [ids.parks, ids.civic] : [ids.civic])
  }
  for (let i = 0; i < 11; i++) await createEvent(day(-1 - Math.floor(i / 2)), [ids.civic])
  // Parks only, interleaved with the civic days; and events with no category
  for (const offset of [0, 1, 3, -2, -4]) await createEvent(day(offset), [ids.parks])
  for (const offset of [2, -3]) await createEvent(day(offset), [])
  // Drafts: a Family event only drafts have, and civic drafts among the civic days
  await createEvent(day(5), [ids.family], false)
  for (const offset of [1, 4, -2]) await createEvent(day(offset), [ids.civic], false)
}, 60_000)

/** The published events of `category` in the listing now, in its order. */
async function listingNow(scope: EventScope, categoryId: number) {
  const { docs } = await payload.find({
    collection: 'events',
    pagination: false,
    sort: scope === 'upcoming' ? ['date', 'id'] : ['-date', '-id'],
    where: {
      and: [
        { _status: { equals: 'published' } },
        scope === 'upcoming' ? { date: { greater_than_equal: TODAY } } : { date: { less_than: TODAY } },
        { categories: { in: [categoryId] } },
      ],
    },
    select: {},
    overrideAccess: true,
  })
  return docs.map((doc) => doc.id)
}

function read(
  scope: EventScope,
  categoryId: number,
  between?: (onScreen: number[]) => Promise<void>,
) {
  return readListing({
    first: () => queries.findEventPage(scope, 1, TODAY, categoryId),
    after: (cursor) => {
      const parsed = parseCursor(cursor)
      if (!parsed) throw new Error(`The server returned a bad cursor: ${cursor}`)
      return queries.findEventsAfter(scope, parsed, TODAY, categoryId)
    },
    between,
  })
}

describe('the filter row', () => {
  it('offers the categories with published events, by title, with their counts', async () => {
    const menu = await categories.findEventFilterMenu(TODAY)

    expect(menu.all).toEqual({ upcoming: 15 + 3 + 1, past: 11 + 2 + 1 })
    expect(menu.categories).toEqual([
      { id: ids.civic, slug: 'civic', title: 'Civic', counts: { upcoming: 15, past: 11 } },
      { id: ids.parks, slug: 'parks', title: 'Parks', counts: { upcoming: 4 + 3, past: 2 } },
    ])
  })

  it('offers nothing when no published event has a category', async () => {
    await payload.update({
      collection: 'events',
      where: { id: { exists: true } },
      data: { categories: [] },
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
    expect((await categories.findEventFilterMenu(TODAY)).categories).toEqual([])
  })
})

describe('the "Load more" lookup of a filter', () => {
  it('finds a category by its exact slug, and nothing for any other', async () => {
    expect(await categories.findCategoryIdBySlug('civic')).toBe(ids.civic)
    expect(await categories.findCategoryIdBySlug('unused')).toBe(ids.unused)
    expect(await categories.findCategoryIdBySlug('civ')).toBeNull()
    expect(await categories.findCategoryIdBySlug('no-such-category')).toBeNull()
  })

  it('lists nothing for a category without published events', async () => {
    const { docs } = await queries.findEventPage('upcoming', 1, TODAY, ids.family)
    expect(docs).toEqual([])
  })
})

describe.each<EventScope>(['upcoming', 'past'])('the %s listing of one category', (scope) => {
  it('holds only its published events, with the right count, across "Load more"', async () => {
    const first = await queries.findEventPage(scope, 1, TODAY, ids.civic)
    const listing = await listingNow(scope, ids.civic)

    expect(first.totalDocs).toBe(scope === 'upcoming' ? 15 : 11)
    expect(first.totalDocs).toBe(listing.length)
    expect(first.nextCursor).not.toBeNull()
    const seen = await read(scope, ids.civic)
    expect(seen.ids).toEqual(listing)
  })

  it('counts the category in "Load more" answers too', async () => {
    const cursor = parseCursor((await queries.findEventPage(scope, 1, TODAY, ids.civic)).nextCursor)
    if (!cursor) throw new Error('Page 1 should have a next cursor')
    const after = await queries.findEventsAfter(scope, cursor, TODAY, ids.civic)
    expect(after.totalDocs).toBe((await listingNow(scope, ids.civic)).length)
  })

  it('stays in the category after a cursor from the unfiltered listing', async () => {
    const unfiltered = await queries.findEventPage(scope, 1, TODAY)
    const cursor = parseCursor(unfiltered.nextCursor)
    if (!cursor) throw new Error('The unfiltered page 1 should have a next cursor')

    const { docs } = await queries.findEventsAfter(scope, cursor, TODAY, ids.parks)
    const parks = await listingNow(scope, ids.parks)
    expect(docs.every((doc) => parks.includes(doc.id))).toBe(true)
  })

  it.each<[string, (onScreen: number[]) => Promise<number>]>([
    [
      'unpublishing an event on screen',
      async (onScreen) =>
        (
          await payload.update({
            collection: 'events',
            id: onScreen[2] ?? 0,
            data: { _status: 'draft' },
            overrideAccess: true,
            context: NO_REVALIDATE,
          })
        ).id,
    ],
    [
      'taking an event on screen out of the category',
      async (onScreen) =>
        (
          await payload.update({
            collection: 'events',
            id: onScreen[1] ?? 0,
            data: { categories: [ids.parks] },
            overrideAccess: true,
            context: NO_REVALIDATE,
          })
        ).id,
    ],
    [
      'publishing an event of another category among those not loaded yet',
      async () => (await createEvent(scope === 'upcoming' ? day(7) : day(-5), [ids.parks])).id,
    ],
    [
      'publishing an event of the category among those not loaded yet',
      async () => (await createEvent(scope === 'upcoming' ? day(7) : day(-5), [ids.civic])).id,
    ],
  ])('skips and leaks nothing after %s', async (_label, change) => {
    let changed: number | undefined
    const seen = await read(scope, ids.civic, async (onScreen) => {
      changed = await change(onScreen)
    })
    const listing = await listingNow(scope, ids.civic)
    expectEveryItemOnce(seen, listing, changed)
    // Nothing loaded after page 1 is outside the category or unpublished
    const loaded = seen.ids.slice(seen.onScreen.length)
    expect(loaded.filter((id) => !listing.includes(id))).toEqual([])
  })
})
