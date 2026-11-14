import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The site timezone is read at load time; pin it to the default for every test. */
async function loadFormat() {
  vi.resetModules()
  vi.stubEnv('SITE_TIMEZONE', '')
  return import('./formatDateTime')
}

const DAY_ONLY = '2026-03-03T00:00:00.000Z' // how Payload stores a day-only date (Mar 3)
const EVENING_CST = '2026-03-03T23:30:00.000Z' // 5:30 pm on Mar 3 in Madison (CST, UTC-6)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-20T15:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isDayOnly', () => {
  it('recognises the midnight-UTC form Payload uses for day-only dates', async () => {
    const { isDayOnly } = await loadFormat()
    expect(isDayOnly(DAY_ONLY)).toBe(true)
    expect(isDayOnly(EVENING_CST)).toBe(false)
    expect(isDayOnly('2026-03-03T00:00:00Z')).toBe(false)
  })
})

describe('toDateTimeAttr', () => {
  it('turns a day-only date into a calendar date', async () => {
    const { toDateTimeAttr } = await loadFormat()
    expect(toDateTimeAttr(DAY_ONLY)).toBe('2026-03-03')
  })

  it('keeps a real date-time as a full ISO string', async () => {
    const { toDateTimeAttr } = await loadFormat()
    expect(toDateTimeAttr(EVENING_CST)).toBe(EVENING_CST)
  })
})

describe('formatDateTime', () => {
  it('shows a day-only date on its own day, not the evening before in Central Time', async () => {
    const { formatDateTime } = await loadFormat()
    expect(formatDateTime(DAY_ONLY)).toBe('Tue, Mar 3, 2026')
  })

  it('formats a real date-time in the site timezone', async () => {
    const { formatDateTime } = await loadFormat()
    // 03:30 UTC on Mar 4 is still Mar 3 in Madison
    expect(formatDateTime('2026-03-04T03:30:00.000Z')).toBe('Tue, Mar 3, 2026')
  })
})

describe('formatDateShort', () => {
  it('leaves out the year for dates in the current year', async () => {
    const { formatDateShort } = await loadFormat()
    expect(formatDateShort(DAY_ONLY)).toBe('Mar 3')
  })

  it('adds the year for dates in another year', async () => {
    const { formatDateShort } = await loadFormat()
    expect(formatDateShort('2024-07-25T00:00:00.000Z')).toBe('Jul 25, 2024')
    expect(formatDateShort('2027-01-02T00:00:00.000Z')).toBe('Jan 2, 2027')
  })

  it('decides "current year" in the site timezone', async () => {
    const { formatDateShort } = await loadFormat()
    // New Year's Eve, 11 pm in Madison, is already Jan 1 in UTC
    vi.setSystemTime(new Date('2027-01-01T05:00:00.000Z'))
    expect(formatDateShort('2026-12-31T00:00:00.000Z')).toBe('Dec 31')
  })
})

describe('formatDateBadge', () => {
  it('splits a day-only date into month and day', async () => {
    const { formatDateBadge } = await loadFormat()
    expect(formatDateBadge(DAY_ONLY)).toEqual({ month: 'Mar', day: '3' })
  })

  it('uses the site timezone for real date-times', async () => {
    const { formatDateBadge } = await loadFormat()
    expect(formatDateBadge('2026-03-04T03:30:00.000Z')).toEqual({ month: 'Mar', day: '3' })
  })
})

describe('formatDayShort', () => {
  it('names a calendar day without its weekday, whatever the clock says', async () => {
    const { formatDayShort } = await loadFormat()
    expect(formatDayShort('2026-11-13')).toBe('Nov 13')
    expect(formatDayShort('2026-01-01')).toBe('Jan 1')
  })
})

describe('formatDayLabel', () => {
  it('names a calendar day with its weekday, whatever the clock says', async () => {
    const { formatDayLabel } = await loadFormat()
    expect(formatDayLabel('2026-11-13')).toBe('Fri, Nov 13')
    expect(formatDayLabel('2026-01-01')).toBe('Thu, Jan 1')
  })
})
