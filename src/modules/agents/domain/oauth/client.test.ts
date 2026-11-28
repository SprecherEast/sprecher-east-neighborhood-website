import { describe, expect, it } from 'vitest'

import { clientIsOn } from './client'

const NOW = new Date('2026-11-27T12:00:00Z')

describe('clientIsOn', () => {
  it('is on when switched on and not past its expiry', () => {
    expect(clientIsOn({ enabled: true, expiresAt: null }, NOW)).toBe(true)
    expect(clientIsOn({ enabled: true, expiresAt: new Date('2026-11-28T00:00:00Z') }, NOW)).toBe(
      true,
    )
  })

  it('is off when switched off, whatever its expiry', () => {
    expect(clientIsOn({ enabled: false, expiresAt: null }, NOW)).toBe(false)
  })

  it('is off at and after its expiry', () => {
    expect(clientIsOn({ enabled: true, expiresAt: NOW }, NOW)).toBe(false)
    expect(clientIsOn({ enabled: true, expiresAt: new Date('2026-11-01T00:00:00Z') }, NOW)).toBe(
      false,
    )
  })

  it('is off when its expiry cannot be read, never on', () => {
    expect(clientIsOn({ enabled: true, expiresAt: new Date('not a date') }, NOW)).toBe(false)
  })

  it('is off when there is no client', () => {
    expect(clientIsOn(null, NOW)).toBe(false)
  })
})
