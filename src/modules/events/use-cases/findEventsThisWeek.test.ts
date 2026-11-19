import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import type { EventsThisWeekBlock } from '@/payload-types'
import { bootPayload, NO_REVALIDATE } from '@/platform/payload/testing/inMemoryPayload'

import type { findEventsThisWeek as FindEventsThisWeek } from './findEventsThisWeek'

/**
 * The "this week" strip's rows (#122) on in-memory SQLite: each row holds only published events
 * from today up to the end of the window, soonest first, within its limit; official meetings
 * only in an official row, the chosen category only in a category row. Cancelled events stay.
 */

let payload: Payload
let findEventsThisWeek: typeof FindEventsThisWeek

const TODAY = '2026-06-15T00:00:00.000Z'
const DAY_MS = 86_400_000
const day = (offset: number) => new Date(Date.parse(TODAY) + offset * DAY_MS).toISOString()

const categories = { family: 0, civic: 0 }

type Seed = {
  slug: string
  offset: number
  category?: keyof typeof categories
  officialBody?: 'city' | 'county'
  cancelled?: boolean
  draft?: boolean
}

// Today is day 0; with 7 days the window holds days 0 to 6
const EVENTS: Seed[] = [
  { slug: 'yesterday', offset: -1, category: 'family', officialBody: 'city' },
  { slug: 'today', offset: 0 },
  { slug: 'council', offset: 1, officialBody: 'city' },
  { slug: 'board-cancelled', offset: 2, officialBody: 'county', cancelled: true },
  { slug: 'storytime', offset: 3, category: 'family' },
  { slug: 'family-draft', offset: 4, category: 'family', draft: true },
  { slug: 'official-draft', offset: 1, officialBody: 'city', draft: true },
  { slug: 'garden', offset: 5 },
  { slug: 'last-day', offset: 6 },
  { slug: 'family-next-week', offset: 7, category: 'family' },
  { slug: 'council-next-week', offset: 8, officialBody: 'city' },
]

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  ;({ findEventsThisWeek } = await import('./findEventsThisWeek'))
  for (const key of Object.keys(categories) as (keyof typeof categories)[]) {
    const category = await payload.create({
      collection: 'categories',
      data: { title: key, slug: key },
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
    categories[key] = category.id
  }
  // Created out of date order, so the sort is the query's, not the insertion's
  for (const seed of [...EVENTS].reverse()) {
    await payload.create({
      collection: 'events',
      data: {
        title: seed.slug,
        slug: seed.slug,
        date: day(seed.offset),
        categories: seed.category ? [categories[seed.category]] : [],
        officialBody: seed.officialBody ?? null,
        cancelled: seed.cancelled ?? false,
        _status: seed.draft ? 'draft' : 'published',
      },
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
  }
}, 60_000)

type Row = EventsThisWeekBlock['rows'][number]
const strip = (rows: Row[], days = 7) =>
  findEventsThisWeek({ id: 'b1', heading: 'This week', days, rows }, TODAY)
const slugsByRow = async (rows: Row[], days?: number) =>
  Object.fromEntries(
    (await strip(rows, days)).rows.map(({ title, events }) => [
      title,
      events.map(({ slug }) => slug),
    ]),
  )

describe('the "this week" strip (#122)', () => {
  it('lists every published event in the window, soonest first, within the limit', async () => {
    expect(
      await slugsByRow([
        { title: 'Next three', source: 'all', limit: 3 },
        { title: 'All of them', source: 'all', limit: 6 },
      ]),
    ).toEqual({
      'Next three': ['today', 'council', 'board-cancelled'],
      'All of them': ['today', 'council', 'board-cancelled', 'storytime', 'garden', 'last-day'],
    })
  })

  it('lists only official meetings in an official row, a cancelled one included', async () => {
    const { rows } = await strip([{ title: 'Civic', source: 'official', limit: 6 }])
    expect(
      rows[0]?.events.map(({ slug, officialBody, cancelled }) => [slug, officialBody, cancelled]),
    ).toEqual([
      ['council', 'city', false],
      ['board-cancelled', 'county', true],
    ])
  })

  it('lists only the chosen category’s events in a category row', async () => {
    expect(
      await slugsByRow([
        { title: 'Family', source: 'category', category: categories.family, limit: 6 },
      ]),
    ).toEqual({ Family: ['storytime'] })
  })

  it('hides a row with nothing in the window, and a row whose category is gone', async () => {
    expect(
      await slugsByRow([
        { title: 'Coming up', source: 'all', limit: 1 },
        { title: 'Civic', source: 'category', category: categories.civic, limit: 3 },
        { title: 'Deleted', source: 'category', category: 999_999, limit: 3 },
        { title: 'Unpicked', source: 'category', category: null, limit: 3 },
      ]),
    ).toEqual({ 'Coming up': ['today'] })
  })

  it('narrows to the days asked for: 1 day is today only', async () => {
    expect(await slugsByRow([{ title: 'Today', source: 'all', limit: 6 }], 1)).toEqual({
      Today: ['today'],
    })
  })

  it('has no rows when nothing falls in the window', async () => {
    const later = await findEventsThisWeek(
      { heading: 'This week', days: 7, rows: [{ title: 'Coming up', source: 'all', limit: 3 }] },
      day(30),
    )
    expect(later.rows).toEqual([])
  })
})
