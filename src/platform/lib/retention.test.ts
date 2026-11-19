import { describe, expect, it } from 'vitest'

import { CONFIRMATION_LINK_LIFETIME_MS } from './linkLifetimes'
import { RETENTION, toConfirmedCutoff, toUnconfirmedCutoff } from './retention'

const NOW = Date.parse('2026-10-24T12:00:00.000Z')

describe('the retention rules (#274)', () => {
  it('keeps unconfirmed things 48 hours, longer than a confirmation link works (24 hours)', () => {
    expect(RETENTION.unconfirmedMs).toBe(48 * 60 * 60 * 1000)
    expect(RETENTION.unconfirmedMs).toBeGreaterThan(CONFIRMATION_LINK_LIFETIME_MS)
    expect(toUnconfirmedCutoff(NOW)).toBe('2026-10-22T12:00:00.000Z')
  })

  it('keeps confirmed contact details 12 calendar months', () => {
    expect(toConfirmedCutoff(NOW)).toBe('2025-10-24T12:00:00.000Z')
  })

  it('goes back to the day after February 28 from a February 29', () => {
    expect(toConfirmedCutoff(Date.parse('2028-02-29T06:00:00.000Z'))).toBe(
      '2027-03-01T06:00:00.000Z',
    )
  })
})
