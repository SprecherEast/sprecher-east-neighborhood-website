import 'server-only'

import {
  FORM_CONTENT_TYPE,
  NO_STORE_HEADERS,
  OAUTH_ERROR_NAMES,
  OAUTH_GRANTS,
  REFUSED_DESCRIPTION,
  TOO_MANY_REQUESTS,
} from '../../domain/oauth/constants'
import { resourceMatches } from '../../domain/oauth/resource'
import { tokenError, type TokenAnswer } from '../../domain/oauth/tokenAnswer'
import { getOAuthContext } from '../../data/oauth/context'
import { createConnectionLimit } from './connectionLimit'
import { createOAuthServer, OAuthError, OAuthRequest, OAuthResponse } from './oauthServer'

// In memory, as the MCP limits are: the site runs as one process
const allows = createConnectionLimit()

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
  if (!allows(headers)) return tokenError(429, 'invalid_request', TOO_MANY_REQUESTS)
  // RFC 6749 section 3.2: a parameter is sent once. A repeated one is refused here, as the library
  // would fail on it with an error of its own
  if (Object.values(form).some(Array.isArray)) {
    return tokenError(400, 'invalid_request', 'Send each field once.')
  }
  const grant = form.grant_type
  if (typeof grant !== 'string' || !(OAUTH_GRANTS as readonly string[]).includes(grant)) {
    return tokenError(400, 'unsupported_grant_type', 'Use authorization_code or refresh_token.')
  }
  const { payload, resource } = await getOAuthContext()
  if (form.resource !== undefined && !resourceMatches(String(form.resource), resource)) {
    return tokenError(400, 'invalid_target', `The resource must be ${resource}.`)
  }
  const response = new OAuthResponse()
  try {
    const token = await createOAuthServer(payload, resource).token(
      new OAuthRequest({
        // The library only asks that a form body exists; `form` was read from one by the route
        headers: { 'content-type': FORM_CONTENT_TYPE, 'content-length': '1' },
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
    if (error instanceof OAuthError && OAUTH_ERROR_NAMES.has(error.name)) {
      return tokenError(
        error.code,
        error.name,
        error.name === 'invalid_grant' ? 'The grant is not valid.' : REFUSED_DESCRIPTION,
      )
    }
    // The class name only: a message can hold a token, an address or a query
    const cause = (error as { inner?: Error }).inner ?? error
    payload.logger.error(
      `OAuth token request failed: ${cause instanceof Error ? cause.name : 'unknown'}`,
    )
    return tokenError(500, 'server_error', 'The server could not finish the request.')
  }
}
