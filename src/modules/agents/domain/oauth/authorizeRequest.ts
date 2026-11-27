import { OAUTH_SCOPE } from './constants'
import type { ConsentRequest } from './consent'
import { resourceMatches } from './resource'

/** Query or form values as the framework hands them: a repeated name arrives as an array. */
export type RawParams = Record<string, string | string[] | undefined>

/** The error codes of RFC 6749 and RFC 8707 this request can fail with. */
export type AuthorizeError = {
  code: 'invalid_request' | 'unsupported_response_type' | 'invalid_scope' | 'invalid_target'
  description: string
}

/**
 * The size limits of the request, defined once: the checks below and the approval button's input
 * schema (`consentInput.ts`) must agree, or a page could show what its button then refuses.
 * The challenge is RFC 7636's 43 to 128 characters.
 */
export const REQUEST_LIMITS = {
  clientId: 200,
  redirectUri: 2000,
  state: 512,
  challenge: { min: 43, max: 128 },
} as const

/** RFC 7636: A-Z a-z 0-9 - . _ ~ */
const VERIFIER_SHAPE = new RegExp(
  `^[A-Za-z0-9._~-]{${REQUEST_LIMITS.challenge.min},${REQUEST_LIMITS.challenge.max}}$`,
)
/** RFC 6749 appendix A: printable ASCII, no spaces */
const PRINTABLE = /^[\x21-\x7E]+$/
const MAX = REQUEST_LIMITS

/** A parameter that must appear once; `undefined` when missing, repeated or empty. */
const single = (params: RawParams, name: string): string | undefined => {
  const value = params[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * First step: only the client and where it asked to be sent back. Until the client is known and
 * the address is one of its registered ones, nothing may be redirected, because an error sent to
 * an unchecked address would itself be the attack. So a failure here is shown on the site.
 */
export function readClientAndRedirect(
  params: RawParams,
): { ok: true; clientId: string; redirectUri: string } | { ok: false; message: string } {
  const clientId = single(params, 'client_id')
  const redirectUri = single(params, 'redirect_uri')
  if (!clientId || clientId.length > MAX.clientId || !PRINTABLE.test(clientId)) {
    return { ok: false, message: 'The connection request has no valid client.' }
  }
  if (!redirectUri || redirectUri.length > MAX.redirectUri) {
    return { ok: false, message: 'The connection request has no redirect address.' }
  }
  return { ok: true, clientId, redirectUri }
}

/**
 * A checked request as the standard authorization parameters: the one place they are spelled out,
 * for the approval page's address and for the checks that run again when the button is pressed.
 */
export const toAuthorizeParams = (request: ConsentRequest): Record<string, string> => ({
  response_type: 'code',
  client_id: request.clientId,
  redirect_uri: request.redirectUri,
  code_challenge: request.codeChallenge,
  code_challenge_method: 'S256',
  state: request.state,
  resource: request.resource,
  scope: request.scope,
})

const refuse = (code: AuthorizeError['code'], description: string) =>
  ({ ok: false, error: { code, description } }) as const

/**
 * Second step, once the redirect address is trusted: the rest of the request. Authorization code
 * only, PKCE with S256 only (never `plain`, never none), a state, and the MCP address as the
 * resource, because that is what the token will be for. Errors here go back to the client.
 */
export function readAuthorizeRequest(
  params: RawParams,
  expectedResource: string,
): { ok: true; request: ConsentRequest } | { ok: false; error: AuthorizeError } {
  const clientAndRedirect = readClientAndRedirect(params)
  if (!clientAndRedirect.ok) return refuse('invalid_request', clientAndRedirect.message)
  if (single(params, 'response_type') !== 'code') {
    return refuse('unsupported_response_type', 'Only response_type=code is supported.')
  }
  const challenge = single(params, 'code_challenge')
  if (!challenge || !VERIFIER_SHAPE.test(challenge)) {
    return refuse('invalid_request', 'A PKCE code_challenge of 43 to 128 characters is required.')
  }
  if (single(params, 'code_challenge_method') !== 'S256') {
    return refuse('invalid_request', 'Only code_challenge_method=S256 is supported.')
  }
  const state = single(params, 'state')
  if (!state || state.length > MAX.state || !PRINTABLE.test(state)) {
    return refuse('invalid_request', 'A state of printable characters is required.')
  }
  if (!resourceMatches(single(params, 'resource'), expectedResource)) {
    return refuse('invalid_target', `The resource must be ${expectedResource}.`)
  }
  const scopes = (single(params, 'scope') ?? OAUTH_SCOPE).split(' ').filter(Boolean)
  if (scopes.length === 0 || scopes.some((scope) => scope !== OAUTH_SCOPE)) {
    return refuse('invalid_scope', `The only scope is ${OAUTH_SCOPE}.`)
  }
  return {
    ok: true,
    request: {
      clientId: clientAndRedirect.clientId,
      redirectUri: clientAndRedirect.redirectUri,
      state,
      codeChallenge: challenge,
      resource: expectedResource,
      scope: OAUTH_SCOPE,
    },
  }
}
