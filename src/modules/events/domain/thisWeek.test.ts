import { describe, expect, it } from 'vitest'

import { clampWhole, THIS_WEEK_LIMITS, windowEnd } from './thisWeek'

describe('the "this week" window (#122)', () => {
  it('ends `days` whole days after today, so 7 holds today and the six days after', () => {
    expect(windowEnd('2026-10-27T00:00:00.000Z', 7)).toBe('2026-11-03T00:00:00.000Z')
    expect(windowEnd('2026-10-27T00:00:00.000Z', 1)).toBe('2026-10-28T00:00:00.000Z')
  })

  it('stays on midnight UTC across a daylight-saving change and a month end', () => {
    // US clocks fall back on 2026-11-01; stored dates are midnight UTC, so the window must be too
    expect(windowEnd('2026-10-30T00:00:00.000Z', 3)).toBe('2026-11-02T00:00:00.000Z')
    expect(windowEnd('2026-12-29T00:00:00.000Z', 31)).toBe('2027-01-29T00:00:00.000Z')
  })
})

describe('clampWhole', () => {
  it('keeps a number inside the bounds, as a whole number', () => {
    expect(clampWhole(0, THIS_WEEK_LIMITS.days)).toBe(1)
    expect(clampWhole(99, THIS_WEEK_LIMITS.days)).toBe(31)
    expect(clampWhole(4.6, THIS_WEEK_LIMITS.limit)).toBe(5)
    expect(clampWhole(10, THIS_WEEK_LIMITS.limit)).toBe(6)
  })

  it('falls back to the default when there is no number', () => {
    expect(clampWhole(null, THIS_WEEK_LIMITS.days)).toBe(7)
    expect(clampWhole(undefined, THIS_WEEK_LIMITS.limit)).toBe(3)
    expect(clampWhole(Number.NaN, THIS_WEEK_LIMITS.limit)).toBe(3)
  })
})
