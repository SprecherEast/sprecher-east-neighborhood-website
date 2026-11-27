import { describe, expect, it } from 'vitest'

import { authorizationServerMetadata, bearerChallenge, protectedResourceMetadata } from './metadata'

const ORIGIN = 'https://sprechereast.com'

describe('protectedResourceMetadata (RFC 9728)', () => {
  const doc = protectedResourceMetadata(ORIGIN)

  it('names the MCP address exactly as the audience check does', () => {
    expect(doc.resource).toBe('https://sprechereast.com/api/mcp')
  })

  it('lists this site as the one authorization server (Claude reads only the first)', () => {
    expect(doc.authorization_servers).toEqual([ORIGIN])
  })

  it('takes bearer tokens in the header only, never in the query', () => {
    expect(doc.bearer_methods_supported).toEqual(['header'])
  })

  it('does not double a trailing slash of the origin', () => {
    expect(protectedResourceMetadata(`${ORIGIN}/`).authorization_servers).toEqual([ORIGIN])
  })
})

describe('authorizationServerMetadata (RFC 8414)', () => {
  const doc = authorizationServerMetadata(ORIGIN)

  it('uses the origin as its issuer and points at our own addresses', () => {
    expect(doc.issuer).toBe(ORIGIN)
    expect(doc.authorization_endpoint).toBe(`${ORIGIN}/oauth/authorize`)
    expect(doc.token_endpoint).toBe(`${ORIGIN}/oauth/token`)
  })

  it('offers PKCE S256 and nothing weaker', () => {
    expect(doc.code_challenge_methods_supported).toEqual(['S256'])
  })

  it('offers the code and refresh grants only, with no secret-less implicit or client credentials', () => {
    expect(doc.response_types_supported).toEqual(['code'])
    expect(doc.grant_types_supported).toEqual(['authorization_code', 'refresh_token'])
  })

  it('has no open registration', () => {
    expect(doc).not.toHaveProperty('registration_endpoint')
  })

  it('has public clients only', () => {
    expect(doc.token_endpoint_auth_methods_supported).toEqual(['none'])
  })
})

describe('bearerChallenge', () => {
  it('points at the protected-resource metadata for the MCP address', () => {
    expect(bearerChallenge(ORIGIN)).toBe(
      'Bearer resource_metadata="https://sprechereast.com/.well-known/oauth-protected-resource/api/mcp"',
    )
  })
})
