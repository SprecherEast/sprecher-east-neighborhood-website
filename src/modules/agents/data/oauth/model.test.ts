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
