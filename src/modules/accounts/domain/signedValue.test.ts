import { describe, expect, it } from 'vitest'

import { purposeKey, readSignedValue, signValue } from './signedValue'
import { hostCookieName, toPendingLinkId, toSocialFlow } from './socialCookies'

const now = new Date('2026-10-27T12:00:00Z')
const later = (ms: number) => new Date(now.getTime() + ms)
const key = purposeKey('payload-secret-for-tests-only-0123456789', 'social-flow')

describe('signValue and readSignedValue', () => {
  it('reads back what it signed, with its expiry', () => {
    const value = signValue({ a: 1 }, key, now, 60_000)
    expect(readSignedValue(value, key, now)).toEqual({ a: 1, exp: now.getTime() + 60_000 })
  })

  it('refuses a value past its expiry', () => {
    const value = signValue({ a: 1 }, key, now, 60_000)
    expect(readSignedValue(value, key, later(60_000))).toBeNull()
  })

  it('refuses a changed value, a changed signature and a value from another purpose', () => {
    const value = signValue({ role: 'resident' }, key, now, 60_000)
    const [body, mac] = value.split('.')
    const forged = Buffer.from(JSON.stringify({ role: 'admin', exp: later(60_000).getTime() }))
    expect(readSignedValue(`${forged.toString('base64url')}.${mac}`, key, now)).toBeNull()
    expect(readSignedValue(`${body}.${mac?.slice(1)}x`, key, now)).toBeNull()
    const other = purposeKey('payload-secret-for-tests-only-0123456789', 'another-purpose')
    expect(readSignedValue(value, other, now)).toBeNull()
  })

  it('refuses anything that isn’t a signed object', () => {
    for (const value of [null, undefined, '', 'abc', 'a.b.c', '.', `${'x'}.`]) {
      expect(readSignedValue(value, key, now)).toBeNull()
    }
  })
})

describe('hostCookieName', () => {
  it('prefixes the name only where cookies are Secure', () => {
    expect(hostCookieName('flow', true)).toBe('__Host-flow')
    expect(hostCookieName('flow', false)).toBe('flow')
  })
})

describe('the flow cookie', () => {
  it('reads a flow only with every check in it', () => {
    const flow = { provider: 'google', state: 's', codeVerifier: 'v', nonce: 'n' }
    expect(toSocialFlow(flow)).toEqual({ ...flow, linkAccountId: null })
    expect(toSocialFlow({ ...flow, provider: 'apple' })).toBeNull()
    expect(toSocialFlow({ ...flow, state: 1 })).toBeNull()
    expect(toSocialFlow(null)).toBeNull()
  })

  it('keeps the account a link flow was started from, and only a real account id', () => {
    const flow = { provider: 'google', state: 's', codeVerifier: 'v', nonce: 'n' }
    expect(toSocialFlow({ ...flow, linkAccountId: 7 })?.linkAccountId).toBe(7)
    expect(toSocialFlow({ ...flow, linkAccountId: null })?.linkAccountId).toBeNull()
    for (const bad of ['7', 0, -1, 1.5, {}]) {
      expect(toSocialFlow({ ...flow, linkAccountId: bad })).toBeNull()
    }
  })

  it('reads a pending link only as a row id, so a flow never reads as one and the other way round', () => {
    expect(toPendingLinkId({ pid: 12 })).toBe(12)
    for (const bad of [{ pid: '12' }, { pid: 0 }, { pid: 1.5 }, { state: 's' }, null]) {
      expect(toPendingLinkId(bad)).toBeNull()
    }
    expect(toSocialFlow({ pid: 12 })).toBeNull()
  })
})
