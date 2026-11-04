import { describe, expect, it } from 'vitest'

import { TITLE_MAX_LENGTH } from '@/platform/lib'

import {
  type CategoryNode,
  pickDefaultImage,
  SUGGESTION_CAPS,
  toEventSchedule,
  toSuggestionSlug,
} from './suggestion'

const CHICAGO = 'America/Chicago'

describe('SUGGESTION_CAPS', () => {
  it('lets a suggested title be no longer than the CMS saves (#633)', () => {
    // A longer one would pass the tool's check and only fail later, when an editor publishes it
    expect(SUGGESTION_CAPS.title).toBe(TITLE_MAX_LENGTH)
  })
})

describe('toEventSchedule', () => {
  it('turns a start and end into the day and times in the site timezone', () => {
    expect(
      toEventSchedule(
        { startsAt: '2026-11-07T23:30:00.000Z', endsAt: '2026-11-08T01:00:00.000Z' },
        CHICAGO,
      ),
    ).toEqual({ date: '2026-11-07T00:00:00.000Z', timeStart: '5:30 PM', timeEnd: '7:00 PM' })
  })

  it('reads an offset, so the day is the local one', () => {
    expect(toEventSchedule({ startsAt: '2026-11-08T00:30:00-06:00' }, CHICAGO)).toEqual({
      date: '2026-11-08T00:00:00.000Z',
      timeStart: '12:30 AM',
      timeEnd: null,
    })
  })

  it('gives no times for an all-day event', () => {
    const none = { timeStart: null, timeEnd: null }
    expect(
      toEventSchedule({ startsAt: '2026-11-07T18:00:00-06:00', allDay: true }, CHICAGO),
    ).toEqual({ date: '2026-11-07T00:00:00.000Z', ...none })
  })

  it('leaves out an end on another day', () => {
    expect(
      toEventSchedule(
        { startsAt: '2026-11-07T18:00:00-06:00', endsAt: '2026-11-09T18:00:00-06:00' },
        CHICAGO,
      ).timeEnd,
    ).toBeNull()
  })
})

describe('toSuggestionSlug', () => {
  it('is the title in URL form with the start of the fingerprint', () => {
    expect(toSuggestionSlug('Café Night at the Park!', 'ABCDEF0123456789')).toBe(
      'cafe-night-at-the-park-abcdef01',
    )
  })

  it('stays short and never empty', () => {
    expect(toSuggestionSlug('x'.repeat(300), 'ff').length).toBeLessThanOrEqual(63)
    expect(toSuggestionSlug('!!!', '12')).toBe('suggestion-12')
  })
})

describe('pickDefaultImage', () => {
  const node = (id: number, parentId: number | null, defaultImageId: number | null) =>
    [id, { id, parentId, defaultImageId }] as [number, CategoryNode]
  const tree = new Map([
    node(1, null, 10), // Parks, with an image
    node(2, 1, null), // Nature walks, under Parks, without one
    node(3, null, null), // Volunteer, without one
    node(4, null, 40), // Community, with one
    node(5, 6, null), // a loop: 5 → 6 → 5
    node(6, 5, null),
  ])

  it('uses the first category’s own image', () => {
    expect(pickDefaultImage([4, 1], tree)).toBe(40)
  })

  it('falls back to the parent’s image', () => {
    expect(pickDefaultImage([2], tree)).toBe(10)
  })

  it('tries the next category when the first has none up its tree', () => {
    expect(pickDefaultImage([3, 4], tree)).toBe(40)
  })

  it('is null when none has one, and stops on a loop', () => {
    expect(pickDefaultImage([3], tree)).toBeNull()
    expect(pickDefaultImage([5], tree)).toBeNull()
    expect(pickDefaultImage([99], tree)).toBeNull()
  })
})
