import { describe, expect, it } from 'vitest'

import { formatDuration } from './formatDuration'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatDuration', () => {
  it('says "a" for one unit, the way a neighbor would', () => {
    expect(formatDuration(HOUR)).toBe('an hour')
    expect(formatDuration(DAY)).toBe('a day')
    expect(formatDuration(MINUTE)).toBe('a minute')
  })

  it('counts several units', () => {
    expect(formatDuration(3 * HOUR)).toBe('3 hours')
    expect(formatDuration(2 * DAY)).toBe('2 days')
    expect(formatDuration(30 * MINUTE)).toBe('30 minutes')
  })

  it('uses the largest unit that divides evenly', () => {
    expect(formatDuration(90 * MINUTE)).toBe('90 minutes')
    expect(formatDuration(48 * HOUR)).toBe('2 days')
  })

  it('rejects a duration under a minute or not a whole number of minutes', () => {
    expect(() => formatDuration(0)).toThrow()
    expect(() => formatDuration(30_000)).toThrow()
    expect(() => formatDuration(MINUTE + 1)).toThrow()
  })
})
