import { describe, expect, it } from 'vitest'

import {
  readAuthorizeRequest,
  readClientAndRedirect,
  REQUEST_LIMITS,
  toAuthorizeParams,
} from './authorizeRequest'

const RESOURCE = 'https://sprechereast.com/api/mcp'
const valid = {
  response_type: 'code',
  client_id: 'mcp_abc',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
  state: 'state-123',
  resource: RESOURCE,
}
const read = (over: Record<string, string | string[] | undefined> = {}) =>
  readAuthorizeRequest({ ...valid, ...over }, RESOURCE)

describe('readClientAndRedirect', () => {
  it('reads the client and the redirect address', () => {
    expect(readClientAndRedirect(valid)).toEqual({
      ok: true,
      clientId: 'mcp_abc',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
    })
  })

  it.each([
    ['client_id', undefined],
    ['client_id', ''],
    ['client_id', ['a', 'b']],
    ['client_id', 'has space'],
    ['client_id', 'x'.repeat(201)],
    ['redirect_uri', undefined],
    ['redirect_uri', ''],
    ['redirect_uri', ['https://a.example/x', 'https://b.example/x']],
    ['redirect_uri', 'x'.repeat(2001)],
  ])('refuses %s = %j (nothing may be redirected yet)', (name, value) => {
    expect(readClientAndRedirect({ ...valid, [name]: value }).ok).toBe(false)
  })
})

describe('readAuthorizeRequest', () => {
  it('accepts a complete request and defaults the scope', () => {
    expect(read()).toEqual({
      ok: true,
      request: {
        clientId: 'mcp_abc',
        redirectUri: valid.redirect_uri,
        state: 'state-123',
        codeChallenge: valid.code_challenge,
        resource: RESOURCE,
        scope: 'mcp',
      },
    })
  })

  it('accepts the one scope, alone or among repeats of itself', () => {
    expect(read({ scope: 'mcp' })).toMatchObject({ ok: true })
    expect(read({ scope: 'mcp mcp' })).toMatchObject({ ok: true })
  })

  const refused: [string, Record<string, string | string[] | undefined>, string][] = [
    ['a token response type', { response_type: 'token' }, 'unsupported_response_type'],
    ['no response type', { response_type: undefined }, 'unsupported_response_type'],
    ['no challenge', { code_challenge: undefined }, 'invalid_request'],
    ['a short challenge', { code_challenge: 'abc' }, 'invalid_request'],
    ['a long challenge', { code_challenge: 'a'.repeat(129) }, 'invalid_request'],
    ['a challenge with + or =', { code_challenge: `${'a'.repeat(42)}+` }, 'invalid_request'],
    ['the plain method', { code_challenge_method: 'plain' }, 'invalid_request'],
    ['no method', { code_challenge_method: undefined }, 'invalid_request'],
    ['a lower-case method', { code_challenge_method: 's256' }, 'invalid_request'],
    ['no state', { state: undefined }, 'invalid_request'],
    ['an empty state', { state: '' }, 'invalid_request'],
    ['a state with a control character', { state: 'a\nb' }, 'invalid_request'],
    ['a very long state', { state: 'a'.repeat(513) }, 'invalid_request'],
    ['no resource', { resource: undefined }, 'invalid_target'],
    ['another resource', { resource: 'https://sprechereast.com/api/graphql' }, 'invalid_target'],
    ['two resources', { resource: [RESOURCE, RESOURCE] }, 'invalid_target'],
    ['another scope', { scope: 'mcp admin' }, 'invalid_scope'],
    [
      'two challenges',
      { code_challenge: [valid.code_challenge, valid.code_challenge] },
      'invalid_request',
    ],
    ['two states', { state: ['a', 'b'] }, 'invalid_request'],
  ]
  it.each(refused)('refuses %s', (_name, over, code) => {
    const result = read(over)
    expect(result).toMatchObject({ ok: false, error: { code } })
  })
})

describe('the PKCE refusal', () => {
  it('names the limits the check uses, not a copy of them', () => {
    const { min, max } = REQUEST_LIMITS.challenge
    const refused = read({ code_challenge: 'a'.repeat(min - 1) })
    expect(refused).toMatchObject({
      ok: false,
      error: { description: `A PKCE code_challenge of ${min} to ${max} characters is required.` },
    })
  })
})

describe('toAuthorizeParams', () => {
  it('spells the standard parameters, and the checks read them back to the same request', () => {
    const read1 = read()
    if (!read1.ok) throw new Error('the valid request must pass')
    const params = toAuthorizeParams(read1.request)
    expect(params).toEqual({
      response_type: 'code',
      client_id: valid.client_id,
      redirect_uri: valid.redirect_uri,
      code_challenge: valid.code_challenge,
      code_challenge_method: 'S256',
      state: valid.state,
      resource: RESOURCE,
      scope: 'mcp',
    })
    expect(readAuthorizeRequest(params, RESOURCE)).toEqual(read1)
  })
})

describe('REQUEST_LIMITS', () => {
  it('are the sizes the checks accept, to the character', () => {
    const { clientId, redirectUri, state, challenge } = REQUEST_LIMITS
    const at = (over: Record<string, string>) => read(over).ok
    expect(at({ client_id: 'c'.repeat(clientId) })).toBe(true)
    expect(at({ client_id: 'c'.repeat(clientId + 1) })).toBe(false)
    expect(at({ redirect_uri: `https://a.test/${'p'.repeat(redirectUri - 15)}` })).toBe(true)
    expect(at({ redirect_uri: `https://a.test/${'p'.repeat(redirectUri - 14)}` })).toBe(false)
    expect(at({ state: 's'.repeat(state) })).toBe(true)
    expect(at({ state: 's'.repeat(state + 1) })).toBe(false)
    expect(at({ code_challenge: 'a'.repeat(challenge.min) })).toBe(true)
    expect(at({ code_challenge: 'a'.repeat(challenge.min - 1) })).toBe(false)
    expect(at({ code_challenge: 'a'.repeat(challenge.max) })).toBe(true)
    expect(at({ code_challenge: 'a'.repeat(challenge.max + 1) })).toBe(false)
  })
})
