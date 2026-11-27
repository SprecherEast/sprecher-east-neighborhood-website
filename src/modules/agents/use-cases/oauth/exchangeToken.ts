import 'server-only'

import { parseClientIp, SlidingWindowCounter } from '@/platform/lib'

import { NO_STORE_HEADERS, OAUTH_GRANTS, OAUTH_TOKEN_LIMIT } from '../../domain/oauth/constants'
import { resourceMatches } from '../../domain/oauth/resource'
import { getOAuthContext } from '../../data/oauth/context'
import { createOAuthServer, OAuthError, OAuthRequest, OAuthResponse } from './oauthServer'

export type TokenAnswer = { status: number; headers: Record<string, string>; body: unknown }

// In memory, as the MCP limits are: the site runs as one process
const attempts = new SlidingWindowCounter(
  OAUTH_TOKEN_LIMIT.windowMs,
  OAUTH_TOKEN_LIMIT.trackedConnections,
)

const failure = (status: number, error: string, description: string): TokenAnswer => ({
  status,
  headers: NO_STORE_HEADERS,
  body: { error, error_description: description },
})

/** The only error names a token request may answer with: RFC 6749 section 5.2 and RFC 8707. */
const CODES = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope',
  'invalid_target',
])

/**
 * The token address (#1501): refuses a field sent twice, then trades an authorization code (with its PKCE verifier) or a refresh
 * token for new tokens, through the OAuth library. Before it: a limit per connection; only the two
 * grants we offer; and a `resource`, when the client sends one, must be the MCP address. After
 * it: only plain OAuth error names leave, never a library or database message, and nothing is
 * cached. `form` holds the form fields; `headers` the request's.
 */
export async function exchangeToken(
  form: Record<string, string | string[] | undefined>,
  headers: Headers,
): Promise<TokenAnswer> {
  const ip = parseClientIp(headers)
  if (ip && !attempts.tryTake(ip, OAUTH_TOKEN_LIMIT.perConnection, Date.now())) {
    return failure(429, 'invalid_request', 'Too many requests. Try again in a minute.')
  }
  // RFC 6749 section 3.2: a parameter is sent once. A repeated one is refused here, as the library
  // would fail on it with an error of its own
  if (Object.values(form).some(Array.isArray)) {
    return failure(400, 'invalid_request', 'Send each field once.')
  }
  const grant = form.grant_type
  if (typeof grant !== 'string' || !(OAUTH_GRANTS as readonly string[]).includes(grant)) {
    return failure(400, 'unsupported_grant_type', 'Use authorization_code or refresh_token.')
  }
  const { payload, resource } = await getOAuthContext()
  if (form.resource !== undefined && !resourceMatches(String(form.resource), resource)) {
    return failure(400, 'invalid_target', `The resource must be ${resource}.`)
  }
  const response = new OAuthResponse()
  try {
    const token = await createOAuthServer(payload, resource).token(
      new OAuthRequest({
        // The library only asks that a form body exists; `form` was read from one by the route
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '1' },
        method: 'POST',
        query: {},
        body: form,
      }),
      response,
    )
    return {
      status: 200,
      // The library sets the same cache headers under its own spelling: ours are the only ones
      headers: NO_STORE_HEADERS,
      body: {
        access_token: token.accessToken,
        token_type: 'Bearer',
        expires_in: Math.max(
          0,
          Math.floor(((token.accessTokenExpiresAt?.getTime() ?? 0) - Date.now()) / 1000),
        ),
        refresh_token: token.refreshToken,
        scope: (token.scope ?? []).join(' '),
      },
    }
  } catch (error) {
    if (error instanceof OAuthError && CODES.has(error.name)) {
      return failure(
        error.code,
        error.name,
        error.name === 'invalid_grant' ? 'The grant is not valid.' : 'The request was refused.',
      )
    }
    // The class name only: a message can hold a token, an address or a query
    const cause = (error as { inner?: Error }).inner ?? error
    payload.logger.error(
      `OAuth token request failed: ${cause instanceof Error ? cause.name : 'unknown'}`,
    )
    return failure(500, 'server_error', 'The server could not finish the request.')
  }
}
