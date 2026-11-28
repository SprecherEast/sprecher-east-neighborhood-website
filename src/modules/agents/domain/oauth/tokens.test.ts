import { describe, expect, it } from 'vitest'

import { checkToken, type StoredToken } from './tokens'

const NOW = new Date('2026-11-26T12:00:00Z')
const RESOURCE = 'https://sprechereast.com/api/mcp'
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000)

const token = (over: Partial<StoredToken> = {}): StoredToken => ({
  kind: 'access',
  expiresAt: minutes(30),
  resource: RESOURCE,
  agentId: 9,
  client: { enabled: true, agentId: 9 },
  ...over,
})
const check = (t: StoredToken, kind: StoredToken['kind'] = 'access') =>
  checkToken(t, { kind, resource: RESOURCE, now: NOW })

describe('checkToken', () => {
  it('accepts a live token for this audience', () => {
    expect(check(token())).toBeNull()
  })

  it('refuses a token of the wrong kind (a refresh token is not an access token)', () => {
    expect(check(token({ kind: 'refresh' }))).toBe('wrong-kind')
    expect(check(token(), 'refresh')).toBe('wrong-kind')
  })

  it('refuses a token for another audience', () => {
    expect(check(token({ resource: 'https://sprechereast.com/api/graphql' }))).toBe(
      'wrong-audience',
    )
    expect(check(token({ resource: '' }))).toBe('wrong-audience')
  })

  it('refuses an expired token, also at the exact moment it expires', () => {
    expect(check(token({ expiresAt: minutes(-1) }))).toBe('expired')
    expect(check(token({ expiresAt: NOW }))).toBe('expired')
  })

  it('refuses a revoked token', () => {
    expect(check(token({ revokedAt: minutes(-5) }))).toBe('revoked')
  })

  it('refuses a token that was already used', () => {
    expect(check(token({ kind: 'refresh', usedAt: minutes(-5) }), 'refresh')).toBe('used')
    expect(check(token({ kind: 'code', usedAt: minutes(-1) }), 'code')).toBe('used')
  })

  it('refuses a token whose client was switched off', () => {
    expect(check(token({ client: { enabled: false, agentId: 9 } }))).toBe('client-disabled')
  })

  it('refuses a token given as one agent account once its client acts as another', () => {
    expect(check(token({ client: { enabled: true, agentId: 10 } }))).toBe('agent-changed')
    // A client row that did not say its agent (read as 0) can never match
    expect(check(token({ client: { enabled: true, agentId: 0 } }))).toBe('agent-changed')
  })

  it('reports reuse before expiry, so a replay always revokes the family', () => {
    expect(
      check(token({ kind: 'refresh', usedAt: minutes(-5), expiresAt: minutes(-1) }), 'refresh'),
    ).toBe('used')
  })
})
