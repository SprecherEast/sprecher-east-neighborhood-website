import { describe, expect, it } from 'vitest'

import {
  PASSKEY_OFFER_SNOOZE_MS,
  isPasskeyOfferSnoozed,
  passkeyOfferSnoozeUntil,
} from './passkeyOffer'

const NOW = Date.UTC(2026, 10, 20, 12)

describe('the passkey offer’s “not now”', () => {
  it('lasts a month, so the offer is not made at every log in but does come back', () => {
    expect(PASSKEY_OFFER_SNOOZE_MS).toBe(30 * 24 * 60 * 60 * 1000)
    expect(passkeyOfferSnoozeUntil(NOW)).toBe(String(NOW + PASSKEY_OFFER_SNOOZE_MS))
  })

  it('holds the offer back until its time is up', () => {
    const until = passkeyOfferSnoozeUntil(NOW)
    expect(isPasskeyOfferSnoozed(until, NOW + 1)).toBe(true)
    expect(isPasskeyOfferSnoozed(until, NOW + PASSKEY_OFFER_SNOOZE_MS - 1)).toBe(true)
    expect(isPasskeyOfferSnoozed(until, NOW + PASSKEY_OFFER_SNOOZE_MS)).toBe(false)
  })

  it('offers when nothing is stored, or what is stored is not a time', () => {
    expect(isPasskeyOfferSnoozed(null, NOW)).toBe(false)
    expect(isPasskeyOfferSnoozed('', NOW)).toBe(false)
    expect(isPasskeyOfferSnoozed('later', NOW)).toBe(false)
    expect(isPasskeyOfferSnoozed('Infinity', NOW)).toBe(false)
  })

  it('does not trust a time far past the snooze, such as one stored by hand', () => {
    expect(isPasskeyOfferSnoozed(String(NOW + 10 * PASSKEY_OFFER_SNOOZE_MS), NOW)).toBe(false)
  })
})
