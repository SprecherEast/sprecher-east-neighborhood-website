import { describe, expect, it } from 'vitest'

import { isBannerExpired } from './bannerExpiry'

// The meeting starts Tue 2026-11-10 at 5:30 PM Central = 23:30 UTC (CST, UTC-6)
const MEETING = '2026-11-10T23:30:00.000Z'

describe('isBannerExpired', () => {
  it('never expires without an end time', () => {
    expect(isBannerExpired(undefined, new Date('2030-01-01T00:00:00Z'))).toBe(false)
    expect(isBannerExpired(null, new Date('2030-01-01T00:00:00Z'))).toBe(false)
    expect(isBannerExpired('', new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })

  it('shows until the minute before the end time', () => {
    expect(isBannerExpired(MEETING, new Date('2026-11-10T23:29:59.999Z'))).toBe(false)
  })

  it('is gone at the end time and after it', () => {
    expect(isBannerExpired(MEETING, new Date('2026-11-10T23:30:00.000Z'))).toBe(true)
    expect(isBannerExpired(MEETING, new Date('2026-11-11T00:00:00.000Z'))).toBe(true)
  })

  it('compares moments, so the viewer or server timezone cannot shift it', () => {
    // 5:29 PM in Madison is still before 5:30 PM, though it is already tomorrow in UTC terms of the day
    expect(isBannerExpired('2026-11-10T17:30:00-06:00', new Date('2026-11-10T23:29:00Z'))).toBe(
      false,
    )
  })

  it('keeps showing when the stored value is not a date, so content is never hidden by a typo', () => {
    expect(isBannerExpired('soon', new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })
})
