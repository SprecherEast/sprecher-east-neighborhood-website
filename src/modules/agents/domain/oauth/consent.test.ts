import { describe, expect, it } from 'vitest'

import { signConsent, verifyConsent, type ConsentRequest } from './consent'

const SECRET = 'site-secret-for-tests'
const NOW = new Date('2026-11-26T12:00:00Z')

const request: ConsentRequest = {
  clientId: 'mcp_abc',
  redirectUri: 'https://claude.ai/api/mcp/auth_callback',
  state: 'xyz',
  codeChallenge: 'a'.repeat(43),
  resource: 'https://sprechereast.com/api/mcp',
  scope: 'read',
}

const ticket = signConsent(request, { adminId: 7, now: NOW, secret: SECRET })
const verify = (
  t = ticket,
  over: Partial<Parameters<typeof verifyConsent>[2]> = {},
  r: ConsentRequest = request,
) => verifyConsent(t, r, { adminId: 7, now: NOW, secret: SECRET, ...over })

describe('consent ticket', () => {
  it('verifies for the admin it was made for, with the same request', () => {
    expect(verify()).toBe(true)
  })

  it('refuses another admin (a ticket cannot be forwarded to someone else)', () => {
    expect(verify(ticket, { adminId: 8 })).toBe(false)
  })

  it.each(Object.keys(request) as (keyof ConsentRequest)[])(
    'refuses a request whose %s was changed',
    (field) => {
      expect(verify(ticket, {}, { ...request, [field]: `${request[field]}x` })).toBe(false)
    },
  )

  it('refuses after it expires, also at the exact moment', () => {
    const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000)
    expect(verify(ticket, { now: later(599) })).toBe(true)
    expect(verify(ticket, { now: later(600) })).toBe(false)
    expect(verify(ticket, { now: later(6000) })).toBe(false)
  })

  it('refuses a ticket made with another secret', () => {
    expect(verify(ticket, { secret: 'other' })).toBe(false)
  })

  it('refuses a stretched expiry, since the expiry is part of what is signed', () => {
    const [exp, mac] = ticket.split('.')
    const stretched = `${Number(exp) + 100000}.${mac}`
    expect(verify(stretched, { now: new Date(NOW.getTime() + 700_000) })).toBe(false)
  })

  it.each(['', 'abc', '.', '123.', '.abc', 'x.y', '1.2.3', 'NaN.abc'])(
    'refuses junk %j',
    (junk) => {
      expect(verify(junk)).toBe(false)
    },
  )

  it('refuses a ticket with a part added, or a signature of the wrong length', () => {
    expect(verify(`${ticket}.extra`)).toBe(false)
    expect(verify(`${ticket}x`)).toBe(false)
    expect(verify('9999999999.AAAA')).toBe(false)
    expect(verify(`9999999999.${ticket.split('.')[1]}`)).toBe(false)
  })

  it('does not confuse fields that share characters', () => {
    const a = signConsent(
      { ...request, state: 'ab', scope: 'c' },
      { adminId: 7, now: NOW, secret: SECRET },
    )
    expect(verify(a, {}, { ...request, state: 'a', scope: 'bc' })).toBe(false)
  })
})
