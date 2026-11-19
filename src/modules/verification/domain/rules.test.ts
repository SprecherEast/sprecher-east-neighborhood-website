import { describe, expect, it } from 'vitest'

import { RETENTION } from '@/platform/lib'

import { CONFIRMATION_LIMITS } from './limits'
import { checkAddressLimit, checkLink, toLinkStatus, toTokenExpiry } from './rules'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NOW = Date.parse('2026-10-22T12:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

describe('checkAddressLimit', () => {
  it('starts a window for a new address', () => {
    expect(checkAddressLimit(null, NOW)).toEqual({
      ok: true,
      sendCount: 1,
      sendWindowStart: iso(NOW),
    })
  })

  it('allows 3 links a day to one address, then refuses', () => {
    const start = iso(NOW - HOUR)
    expect(checkAddressLimit({ sendCount: 2, sendWindowStart: start }, NOW)).toEqual({
      ok: true,
      sendCount: 3,
      sendWindowStart: start,
    })
    expect(checkAddressLimit({ sendCount: 3, sendWindowStart: start }, NOW)).toEqual({ ok: false })
  })

  it('starts a new window once a day has passed', () => {
    const record = { sendCount: 3, sendWindowStart: iso(NOW - DAY) }
    expect(checkAddressLimit(record, NOW)).toEqual({
      ok: true,
      sendCount: 1,
      sendWindowStart: iso(NOW),
    })
  })

  it('starts a new window when the stored start is missing or unreadable', () => {
    expect(checkAddressLimit({ sendCount: 3, sendWindowStart: null }, NOW)).toMatchObject({
      ok: true,
      sendCount: 1,
    })
    expect(checkAddressLimit({ sendCount: 3, sendWindowStart: 'junk' }, NOW)).toMatchObject({
      ok: true,
      sendCount: 1,
    })
  })
})

describe('toTokenExpiry', () => {
  it('is 24 hours after sending', () => {
    expect(toTokenExpiry(NOW)).toBe(iso(NOW + DAY))
  })
})

describe('the limits and the retention rules (#274)', () => {
  it('end a link, and the per-address window, before an unconfirmed record is deleted', () => {
    expect(CONFIRMATION_LIMITS.linkLifetimeMs).toBe(DAY)
    expect(CONFIRMATION_LIMITS.linkLifetimeMs).toBeLessThan(RETENTION.unconfirmedMs)
    expect(CONFIRMATION_LIMITS.addressWindowMs).toBeLessThan(RETENTION.unconfirmedMs)
  })
})

describe('checkLink', () => {
  it('confirms a link before it expires', () => {
    expect(checkLink({ confirmedAt: null, tokenExpiresAt: iso(NOW + 1) }, NOW)).toBe('confirm')
  })

  it('says a link expired at its expiry time or after', () => {
    expect(checkLink({ confirmedAt: null, tokenExpiresAt: iso(NOW) }, NOW)).toBe('expired')
    expect(checkLink({ confirmedAt: null, tokenExpiresAt: null }, NOW)).toBe('expired')
  })

  it('says a link was already used once the address is confirmed, even after expiry', () => {
    const record = { confirmedAt: iso(NOW - DAY), tokenExpiresAt: iso(NOW - HOUR) }
    expect(checkLink(record, NOW)).toBe('already-confirmed')
  })
})

describe('toLinkStatus (#391)', () => {
  it('reads the same states as following the link, without changing anything', () => {
    expect(toLinkStatus({ confirmedAt: null, tokenExpiresAt: iso(NOW + 1) }, NOW)).toBe('pending')
    expect(toLinkStatus({ confirmedAt: null, tokenExpiresAt: iso(NOW) }, NOW)).toBe('expired')
    expect(toLinkStatus({ confirmedAt: iso(NOW - DAY), tokenExpiresAt: null }, NOW)).toBe(
      'already-confirmed',
    )
  })

  it('says a link no record holds isn’t valid', () => {
    expect(toLinkStatus(null, NOW)).toBe('invalid')
  })
})
