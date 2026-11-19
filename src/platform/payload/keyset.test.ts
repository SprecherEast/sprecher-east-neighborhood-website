import { describe, expect, it } from 'vitest'

import { afterCursor, keysetSort } from './keyset'

const DAY = '2026-10-19T00:00:00.000Z'

describe('keysetSort', () => {
  it('sorts by the field, then the id, both the same way', () => {
    expect(keysetSort('date', 'asc')).toEqual(['date', 'id'])
    expect(keysetSort('publishedAt', 'desc')).toEqual(['-publishedAt', '-id'])
  })
})

describe('afterCursor', () => {
  it('ascending: a later date, or the same date and a later id', () => {
    expect(afterCursor('date', 'asc', { key: DAY, id: 5 })).toEqual({
      or: [
        { date: { greater_than: DAY } },
        { and: [{ date: { equals: DAY } }, { id: { greater_than: 5 } }] },
      ],
    })
  })

  it('descending: an earlier date, the same date and a lower id, or no date (they sort last)', () => {
    expect(afterCursor('publishedAt', 'desc', { key: DAY, id: 5 })).toEqual({
      or: [
        { publishedAt: { less_than: DAY } },
        { and: [{ publishedAt: { equals: DAY } }, { id: { less_than: 5 } }] },
        { publishedAt: { exists: false } },
      ],
    })
  })

  it('ascending after an item with no date: the others without one, then every dated item', () => {
    expect(afterCursor('date', 'asc', { key: null, id: 5 })).toEqual({
      or: [
        { and: [{ date: { exists: false } }, { id: { greater_than: 5 } }] },
        { date: { exists: true } },
      ],
    })
  })

  it('descending after an item with no date: only the others without one remain', () => {
    expect(afterCursor('publishedAt', 'desc', { key: null, id: 5 })).toEqual({
      and: [{ publishedAt: { exists: false } }, { id: { less_than: 5 } }],
    })
  })
})
