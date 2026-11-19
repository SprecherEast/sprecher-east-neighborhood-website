import { describe, expect, it } from 'vitest'

import {
  describeEventCounts,
  eventListTitle,
  eventsHref,
  eventsListHref,
  findFilter,
  isCategorySlug,
} from './filters'

const COUNTS = { upcoming: 1, past: 2 }
const FILTERS = [
  { id: 3, slug: 'civic', title: 'Civic', counts: COUNTS },
  { id: 7, slug: 'parks-and-rec', title: 'Parks and Rec', counts: COUNTS },
]

describe('isCategorySlug', () => {
  it.each(['civic', 'parks-and-rec', 'family_2026', 'a'.repeat(64)])('accepts %s', (slug) => {
    expect(isCategorySlug(slug)).toBe(true)
  })

  it.each<[string, unknown]>([
    ['an empty string', ''],
    ['upper case', 'Civic'],
    ['a space', 'civic events'],
    ['a slash', 'civic/1'],
    ['an encoded character', 'civic%20'],
    ['a dot segment', '..'],
    ['a slug over 64 characters', 'a'.repeat(65)],
    ['a number', 3],
    ['an array', ['civic']],
    ['a Payload query', { equals: 'civic' }],
    ['null', null],
  ])('refuses %s', (_label, value) => {
    expect(isCategorySlug(value)).toBe(false)
  })
})

describe('findFilter', () => {
  it('finds a listed category by its slug', () => {
    expect(findFilter(FILTERS, 'parks-and-rec')).toEqual(FILTERS[1])
  })

  it.each<[string, unknown]>([
    ['a well-formed slug no category has', 'family'],
    ['a malformed slug', 'Civic'],
    ['an id instead of a slug', 3],
    ['a query object', { in: [3, 7] }],
  ])('finds nothing for %s', (_label, slug) => {
    expect(findFilter(FILTERS, slug)).toBeNull()
  })
})

describe('event listing URLs', () => {
  it('links /events, or a category page', () => {
    expect(eventsHref()).toBe('/events')
    expect(eventsHref(null)).toBe('/events')
    expect(eventsHref('civic')).toBe('/events/category/civic')
  })

  it('keeps the category on the no-JavaScript list pages', () => {
    expect(eventsListHref('past', 2)).toBe('/events/list/past/2')
    expect(eventsListHref('upcoming', 3, 'civic')).toBe('/events/category/civic/list/upcoming/3')
  })
})

describe('describeEventCounts', () => {
  it('names the category and splits the total', () => {
    expect(describeEventCounts('Civic', { upcoming: 4, past: 5 })).toBe(
      'Showing 9 Civic events: 4 upcoming and 5 past',
    )
  })

  it('counts every event without a category', () => {
    expect(describeEventCounts(null, { upcoming: 8, past: 12 })).toBe(
      'Showing all 20 events: 8 upcoming and 12 past',
    )
  })

  it('uses the singular for one event', () => {
    expect(describeEventCounts('Parks', { upcoming: 0, past: 1 })).toBe(
      'Showing 1 Parks event: 0 upcoming and 1 past',
    )
  })
})

describe('eventListTitle', () => {
  it('names the scope, and the category when there is one', () => {
    expect(eventListTitle('upcoming')).toBe('Upcoming Events')
    expect(eventListTitle('past', 'Civic')).toBe('Past Civic Events')
  })
})
