import { describe, expect, it } from 'vitest'

import { toCredential, type CredentialRow } from './credentialRow'

const row: CredentialRow = {
  id: 5,
  kind: 'refresh',
  family: 'fam-1',
  client: { id: 2, clientId: 'mcp_abc', enabled: true, agent: 9 },
  agent: { id: 9 },
  consentedBy: 1,
  resource: 'https://sprechereast.com/api/mcp',
  scope: 'read suggest',
  expiresAt: '2026-12-01T00:00:00.000Z',
  usedAt: null,
  revokedAt: '2026-11-30T00:00:00.000Z',
}

describe('toCredential', () => {
  it('reads ids, dates and the scope list', () => {
    expect(toCredential(row)).toMatchObject({
      id: 5,
      kind: 'refresh',
      family: 'fam-1',
      client: { id: 2, clientId: 'mcp_abc', enabled: true, agentId: 9 },
      agentId: 9,
      consentedBy: 1,
      scope: ['read', 'suggest'],
      usedAt: null,
      revokedAt: new Date('2026-11-30T00:00:00.000Z'),
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    })
  })

  it('treats a missing enabled flag as on, and a switched-off client as off', () => {
    expect(toCredential({ ...row, client: { id: 2 } })?.client.enabled).toBe(true)
    expect(toCredential({ ...row, client: { id: 2, enabled: false } })?.client.enabled).toBe(false)
  })

  it('reads the client’s agent account, as an id or a loaded account, and 0 when absent', () => {
    expect(toCredential({ ...row, client: { id: 2, agent: { id: 4 } } })?.client.agentId).toBe(4)
    expect(toCredential({ ...row, client: { id: 2 } })?.client.agentId).toBe(0)
  })

  it('reads the client scopes and expiry, and keeps only scope names', () => {
    const client = {
      id: 2,
      clientId: 'mcp_abc',
      scopes: ['read', 'mcp'],
      expiresAt: '2027-01-01T00:00:00.000Z',
    }
    expect(toCredential({ ...row, client })?.client).toMatchObject({
      scopes: ['read'],
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    })
    expect(toCredential({ ...row, client: { id: 2 } })?.client).toMatchObject({
      scopes: [],
      expiresAt: null,
    })
  })

  it('cannot judge a row whose client was not loaded', () => {
    expect(toCredential({ ...row, client: 2 })).toBeNull()
  })

  it('reads plain ids and a missing admin or scope', () => {
    const plain = toCredential({ ...row, agent: 9, consentedBy: null, scope: null })
    expect(plain).toMatchObject({ agentId: 9, consentedBy: null, scope: [] })
  })
})
