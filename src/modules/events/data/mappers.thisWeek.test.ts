import { describe, expect, it } from 'vitest'

import type { Category, EventsThisWeekBlock } from '@/payload-types'

import type { EventSummary } from '../domain/types'
import { toEventsThisWeekProps, toWindowRowQuery } from './mappers'

const family = { id: 4, title: 'Family', slug: 'family' } as Category

const summary = (slug: string): EventSummary => ({
  id: slug.length,
  slug,
  title: slug,
  date: '2026-10-28T00:00:00.000Z',
  timeStart: null,
  timeEnd: null,
  cancelled: false,
  officialBody: null,
  categories: [],
  description: null,
  locationName: null,
  place: { kind: 'unconfirmed', label: 'Location to be confirmed' },
  image: null,
})

const rows: EventsThisWeekBlock['rows'] = [
  { title: 'Coming up', source: 'all', limit: 3 },
  { title: 'Civic and official', source: 'official', limit: 3 },
  { title: 'Family', source: 'category', category: family, limit: 3 },
]
const block = { id: 'b1', heading: 'This week in Sprecher East', rows }

describe('toEventsThisWeekProps (#122)', () => {
  it('keeps the rows with events, in order, each with its "See all" link', () => {
    const props = toEventsThisWeekProps(block, [
      [summary('potluck')],
      [summary('council')],
      [summary('storytime')],
    ])

    expect(props).toEqual({
      id: 'b1',
      heading: 'This week in Sprecher East',
      allEventsHref: '/events',
      rows: [
        {
          title: 'Coming up',
          events: [summary('potluck')],
          seeAll: { href: '/events', label: 'See all events' },
        },
        {
          title: 'Civic and official',
          events: [summary('council')],
          seeAll: { href: '/events', label: 'See all events' },
        },
        {
          title: 'Family',
          events: [summary('storytime')],
          seeAll: { href: '/events/category/family', label: 'See all Family events' },
        },
      ],
    })
  })

  it('hides a row with no events', () => {
    const props = toEventsThisWeekProps(block, [[summary('potluck')], [], [summary('storytime')]])
    expect(props.rows.map(({ title }) => title)).toEqual(['Coming up', 'Family'])
  })

  it('has no rows when every row is empty, so the strip shows its empty state', () => {
    expect(toEventsThisWeekProps(block, [[], [], []]).rows).toEqual([])
    expect(toEventsThisWeekProps({ ...block, rows: [] }, []).rows).toEqual([])
  })

  it('links a category row to /events when its category isn’t loaded or its slug can’t be a URL', () => {
    for (const category of [4, { ...family, slug: 'Not A Slug' }]) {
      const props = toEventsThisWeekProps(
        { ...block, rows: [{ title: 'Family', source: 'category', category, limit: 3 }] },
        [[summary('storytime')]],
      )
      expect(props.rows[0]?.seeAll).toEqual({ href: '/events', label: 'See all events' })
    }
  })

  it('falls back to the default heading when the editor cleared it', () => {
    expect(toEventsThisWeekProps({ ...block, heading: '  ' }, []).heading).toBe(
      'This week in Sprecher East',
    )
  })
})

describe('toWindowRowQuery (#122)', () => {
  it('asks for a row’s source, with its limit kept between 1 and 6', () => {
    expect(toWindowRowQuery({ title: 'a', source: 'all', limit: 3 })).toEqual({
      source: 'all',
      limit: 3,
    })
    expect(toWindowRowQuery({ title: 'a', source: 'official', limit: 40 })).toEqual({
      source: 'official',
      limit: 6,
    })
  })

  it('asks a category row for its category’s id, loaded or not', () => {
    for (const category of [family, family.id]) {
      expect(toWindowRowQuery({ title: 'a', source: 'category', category, limit: 2 })).toEqual({
        source: 'category',
        categoryId: 4,
        limit: 2,
      })
    }
  })

  it('asks nothing of a category row without a category', () => {
    expect(toWindowRowQuery({ title: 'a', source: 'category', category: null, limit: 3 })).toBe(
      null,
    )
  })
})
