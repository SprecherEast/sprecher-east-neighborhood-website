import { describe, expect, it } from 'vitest'

import { widenToFit } from './shareBarWidths'

const sum = (values: number[]) => values.reduce((all, value) => all + value, 0)

describe('widenToFit', () => {
  it('leaves the widths alone when every slice already fits its label', () => {
    expect(widenToFit([40, 30, 20, 10], [5, 5, 5, 5])).toEqual([40, 30, 20, 10])
  })

  it('draws a slice that is too narrow at its minimum, taking the extra from the others in proportion', () => {
    const drawn = widenToFit([60, 30, 7, 3], [1, 1, 1, 8])
    expect(drawn[3]).toBeCloseTo(8, 9)
    expect(sum(drawn)).toBeCloseTo(100, 9)
    // The other three give up the 5 points in proportion to their widths (60:30:7)
    expect(drawn[0] / drawn[1]).toBeCloseTo(2, 9)
    expect(drawn[0]).toBeCloseTo(60 - (5 * 60) / 97, 9)
  })

  it('widens several slices, and keeps the rest from falling below their own minimum', () => {
    const drawn = widenToFit([50, 40, 6, 4], [1, 12, 9, 9])
    expect(drawn[2]).toBeCloseTo(9, 9)
    expect(drawn[3]).toBeCloseTo(9, 9)
    expect(drawn[1]).toBeGreaterThanOrEqual(12)
    expect(sum(drawn)).toBeCloseTo(100, 9)
  })

  it('scales the minimums down together when they cannot all fit', () => {
    const drawn = widenToFit([70, 30], [80, 80])
    expect(drawn).toEqual([50, 50])
  })

  it('keeps the order and the total of shares that do not add up to 100', () => {
    const drawn = widenToFit([1, 3], [0, 0])
    expect(drawn).toEqual([25, 75])
  })

  it('returns nothing for no slices', () => {
    expect(widenToFit([], [])).toEqual([])
  })
})
