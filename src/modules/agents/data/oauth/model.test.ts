import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createOAuthModel } from './model'

/**
 * What the model answers to the library when a code or a refresh token is spent (#1501): the
 * library reads the answer as "this request got in first". The end-to-end races
 * (`race.payload.test.ts`) cannot tell a wrong `true` from the refusal that follows it, so the
 * answer itself is pinned here, with the database calls replaced.
 */

vi.mock('server-only', () => ({}))
const credentials = vi.hoisted(() => ({
  spendCredential: vi.fn(),
  revokeFamily: vi.fn(),
  saveCredential: vi.fn(),
  isFamilyRevoked: vi.fn(),
}))
vi.mock('./credentials', () => credentials)

const model = () => createOAuthModel({} as Payload, 'https://sprechereast.com/api/mcp')
const spent = { credentialId: 7, user: { family: 'family-1' } }

beforeEach(() => vi.resetAllMocks())

describe.each([
  ['revokeAuthorizationCode', (m: ReturnType<typeof model>) => m.revokeAuthorizationCode(spent as never)],
  ['revokeToken', (m: ReturnType<typeof model>) => m.revokeToken(spent as never)],
])('%s', (_name, spend) => {
  it('answers true and keeps the family when this request spent it first', async () => {
    credentials.spendCredential.mockResolvedValue(true)
    expect(await spend(model())).toBe(true)
    expect(credentials.spendCredential).toHaveBeenCalledWith(expect.anything(), 7)
    expect(credentials.revokeFamily).not.toHaveBeenCalled()
  })

  it('answers false and ends the family when it was already spent (a replay)', async () => {
    credentials.spendCredential.mockResolvedValue(false)
    expect(await spend(model())).toBe(false)
    expect(credentials.revokeFamily).toHaveBeenCalledWith(expect.anything(), 'family-1')
  })
})

describe('what a code and a token save', () => {
  const client = { id: 'mcp_x', grants: [], credentialClientId: 3 }
  const who = { agentId: 1, consentedBy: 2, resource: 'https://sprechereast.com/api/mcp' }
  // No scope from the library is no scope stored: a credential never gets one it was not granted
  const held = { clientId: 3, agentId: 1, consentedBy: 2, resource: who.resource, scope: [] }

  it('gives a code the client, the account and the audience, and no scope when none was granted', async () => {
    const code = { authorizationCode: 'sec_a', expiresAt: new Date(), redirectUri: 'https://x/cb' }
    await model().saveAuthorizationCode(code as never, client as never, who as never)
    expect(credentials.saveCredential).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ...held, kind: 'code', secret: 'sec_a' }),
    )
  })

  it('gives a token the same, and keeps the family it came from', async () => {
    const token = { accessToken: 'sea_a', accessTokenExpiresAt: new Date() }
    await model().saveToken(token as never, client as never, { ...who, family: 'f1' } as never)
    expect(credentials.saveCredential).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ...held, family: 'f1', kind: 'access', secret: 'sea_a' }),
    )
  })
})
