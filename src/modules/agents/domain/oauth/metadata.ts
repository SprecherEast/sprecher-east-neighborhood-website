import { OAUTH_GRANTS, OAUTH_PATHS, OAUTH_SCOPE } from './constants'
import { mcpResource, siteOrigin } from './resource'

/**
 * RFC 9728: what an MCP client reads first, to learn where to sign in. `resource` is the address
 * every token is checked against; `authorization_servers` is this site, and Claude uses only its
 * first entry.
 */
export const protectedResourceMetadata = (origin: string) => ({
  resource: mcpResource(origin),
  authorization_servers: [siteOrigin(origin)],
  bearer_methods_supported: ['header'],
  scopes_supported: [OAUTH_SCOPE],
  resource_name: 'Sprecher East neighborhood agents',
})

/**
 * RFC 8414: the sign-in addresses and what they accept. PKCE S256 only, public clients (no
 * secret), the code and refresh grants, and no registration address: clients are added by hand.
 */
export const authorizationServerMetadata = (origin: string) => ({
  issuer: siteOrigin(origin),
  authorization_endpoint: `${siteOrigin(origin)}${OAUTH_PATHS.authorize}`,
  token_endpoint: `${siteOrigin(origin)}${OAUTH_PATHS.token}`,
  response_types_supported: ['code'],
  grant_types_supported: [...OAUTH_GRANTS],
  code_challenge_methods_supported: ['S256'],
  // RFC 9207: the redirect back carries `iss`, so a client can check which server answered
  authorization_response_iss_parameter_supported: true,
  token_endpoint_auth_methods_supported: ['none'],
  scopes_supported: [OAUTH_SCOPE],
})

/** The `WWW-Authenticate` value of a 401 from the MCP address (RFC 9728, section 5.1). */
export const bearerChallenge = (origin: string): string =>
  `Bearer resource_metadata="${siteOrigin(origin)}${OAUTH_PATHS.protectedResource}${OAUTH_PATHS.mcp}"`
