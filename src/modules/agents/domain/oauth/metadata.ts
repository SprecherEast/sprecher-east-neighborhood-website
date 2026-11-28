import { MINIMAL_SCOPES, type Scope } from '../scopes'
import { DISCOVERY_HEADERS, OAUTH_GRANTS, OAUTH_PATHS } from './constants'
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
  scopes_supported: [...MINIMAL_SCOPES],
  resource_name: 'Sprecher East neighborhood agents',
})

/**
 * RFC 8414: the sign-in addresses and what they accept. PKCE S256 only, public clients (no
 * secret), the code and refresh grants, and no registration address: clients are added by hand.
 */
export const authorizationServerMetadata = (origin: string) => {
  const site = siteOrigin(origin)
  return {
    issuer: site,
    authorization_endpoint: `${site}${OAUTH_PATHS.authorize}`,
    token_endpoint: `${site}${OAUTH_PATHS.token}`,
    response_types_supported: ['code'],
    grant_types_supported: [...OAUTH_GRANTS],
    code_challenge_methods_supported: ['S256'],
    // RFC 9207: the redirect back carries `iss`, so a client can check which server answered
    authorization_response_iss_parameter_supported: true,
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...MINIMAL_SCOPES],
  }
}

/** A discovery document as the public answer both discovery addresses give. */
export const discoveryResponse = (document: object): Response =>
  Response.json(document, { headers: DISCOVERY_HEADERS })

const metadataUrl = (origin: string) =>
  `${siteOrigin(origin)}${OAUTH_PATHS.protectedResource}${OAUTH_PATHS.mcp}`

/**
 * The `WWW-Authenticate` value of a 401 from the MCP address (RFC 9728, section 5.1): where to
 * sign in, and the minimal scope to ask for (the MCP authorization specification's scope selection).
 */
export const bearerChallenge = (origin: string): string =>
  `Bearer scope="${MINIMAL_SCOPES.join(' ')}", resource_metadata="${metadataUrl(origin)}"`

/**
 * The `WWW-Authenticate` value of a 403 from a call the client's scopes do not cover (RFC 6750,
 * section 3.1, and the MCP specification's scope challenge): the scope the call needs.
 */
export const insufficientScopeChallenge = (origin: string, needed: Scope): string =>
  `Bearer error="insufficient_scope", scope="${needed}", resource_metadata="${metadataUrl(origin)}"`
