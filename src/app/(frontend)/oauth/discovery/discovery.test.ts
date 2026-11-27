import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as authorizationServer } from './authorization-server/route'
import { GET as protectedResource } from './protected-resource/route'

/**
 * The two discovery documents (#1501), as MCP clients fetch them through the rewrites of
 * `next.config.js` (`wellKnownRewrites.test.ts`): JSON, readable from any origin,
 * naming the same MCP address the audience check uses.
 */

const ORIGIN = 'https://sprechereast.test'
// Every test starts clean, so the address is set before each
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SERVER_URL', ORIGIN))

describe('the protected-resource document', () => {
  it('answers the document for the MCP address, as public JSON', async () => {
    const response = protectedResource()
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(await response.json()).toMatchObject({
      resource: `${ORIGIN}/api/mcp`,
      authorization_servers: [ORIGIN],
    })
  })
})

describe('the authorization-server document', () => {
  it('answers PKCE S256 only, with our own addresses and no registration address', async () => {
    const doc = await authorizationServer().json()
    expect(doc).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      code_challenge_methods_supported: ['S256'],
      authorization_response_iss_parameter_supported: true,
    })
    expect(doc).not.toHaveProperty('registration_endpoint')
  })
})
