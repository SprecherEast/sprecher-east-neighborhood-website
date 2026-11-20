import { describe, expect, it } from 'vitest'

import { isEventScope, isPastEvent } from './scope'

describe('isPastEvent', () => {
  const today = '2026-10-19T00:00:00.000Z'

  it('counts an event dated before today as past', () => {
    expect(isPastEvent('2026-10-18T00:00:00.000Z', today)).toBe(true)
  })

  it('keeps an event dated today, or later, upcoming', () => {
    expect(isPastEvent('2026-10-19T00:00:00.000Z', today)).toBe(false)
    expect(isPastEvent('2026-11-01T00:00:00.000Z', today)).toBe(false)
  })
})

describe('isEventScope', () => {
  it('accepts only "upcoming" and "past"', () => {
    expect(isEventScope('upcoming')).toBe(true)
    expect(isEventScope('past')).toBe(true)
    expect(isEventScope('Upcoming')).toBe(false)
    expect(isEventScope('all')).toBe(false)
    expect(isEventScope(undefined)).toBe(false)
  })
})
