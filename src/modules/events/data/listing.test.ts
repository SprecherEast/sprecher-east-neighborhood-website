import { describe, expect, it } from 'vitest'

import { inListing } from './listing'

const TODAY = '2026-10-19T00:00:00.000Z'

describe('inListing', () => {
  it('keeps published events in the scope', () => {
    expect(inListing('upcoming', TODAY)).toEqual({
      and: [{ _status: { equals: 'published' } }, { date: { greater_than_equal: TODAY } }],
    })
  })

  it('also keeps only the category given', () => {
    expect(inListing('past', TODAY, 7)).toEqual({
      and: [
        { _status: { equals: 'published' } },
        { date: { less_than: TODAY } },
        { categories: { in: [7] } },
      ],
    })
  })
})
