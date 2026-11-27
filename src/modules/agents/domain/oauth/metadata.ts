import { OAUTH_GRANTS, OAUTH_PATHS, OAUTH_SCOPE } from './constants'
import { mcpResource } from './resource'

const trim = (origin: string) => origin.replace(/\/+$/, '')

/**
 * RFC 9728: what an MCP client reads first, to learn where to sign in. `resource` is the address
 * every token is checked against; `authorization_servers` is this site, and Claude uses only its
 * first entry.
 */
export const protectedResourceMetadata = (origin: string) => ({
  resource: mcpResource(origin),
  authorization_servers: [trim(origin)],
  bearer_methods_supported: ['header'],
  scopes_supported: [OAUTH_SCOPE],
  resource_name: 'Sprecher East neighborhood agents',
})

/**
 * RFC 8414: the sign-in addresses and what they accept. PKCE S256 only, public clients (no
 * secret), the code and refresh grants, and no registration address: clients are added by hand.
 */
export const authorizationServerMetadata = (origin: string) => ({
  issuer: trim(origin),
  authorization_endpoint: `${trim(origin)}${OAUTH_PATHS.authorize}`,
  token_endpoint: `${trim(origin)}${OAUTH_PATHS.token}`,
  response_types_supported: ['code'],
  grant_types_supported: [...OAUTH_GRANTS],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  scopes_supported: [OAUTH_SCOPE],
})

/** The `WWW-Authenticate` value of a 401 from the MCP address (RFC 9728, section 5.1). */
export const bearerChallenge = (origin: string): string =>
  `Bearer resource_metadata="${trim(origin)}${OAUTH_PATHS.protectedResource}${OAUTH_PATHS.mcp}"`
