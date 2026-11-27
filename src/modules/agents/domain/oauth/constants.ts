/**
 * What the OAuth sign-in for MCP clients fixes in one place (#1501): the addresses, how long each
 * credential lives, the one scope, and the prefix that tells our access tokens from an API key.
 * Paths are on the site's own origin; `metadata.ts` joins them to it.
 */
export const OAUTH_PATHS = {
  authorize: '/oauth/authorize',
  approve: '/oauth/approve',
  token: '/oauth/token',
  authorizationServer: '/.well-known/oauth-authorization-server',
  protectedResource: '/.well-known/oauth-protected-resource',
  mcp: '/api/mcp',
} as const

export const OAUTH_LIFETIMES = {
  /** A code is spent in one request right after the redirect */
  codeSeconds: 120,
  /** Short, so a leaked access token is useful for about an hour */
  accessSeconds: 60 * 60,
  /** Each use of a refresh token issues a new one, so this is how long an idle client stays signed in */
  refreshSeconds: 30 * 24 * 60 * 60,
  /** How long an admin has to press the button on the consent page */
  consentSeconds: 10 * 60,
} as const

/** The one scope: what the MCP address already offers an agent account. Narrower scopes: #1499 */
export const OAUTH_SCOPE = 'mcp'

/** Our credentials start with a fixed prefix, so an access token never reaches the API-key lookup */
export const TOKEN_PREFIX = { code: 'sec_', access: 'sea_', refresh: 'ser_' } as const
export type TokenKind = keyof typeof TOKEN_PREFIX

/**
 * Requests a minute from one connection (counted in memory, one process) to the token address, and
 * visits to the authorize and approve pages, each of which reads the database. Each address has its
 * own count; the numbers are one.
 */
export const OAUTH_REQUEST_LIMIT = {
  windowMs: 60 * 1000,
  perConnection: 30,
  trackedConnections: 2000,
}

/** What both pages of a connection say they are for, in the header and in the page's description */
export const CONNECTION_DESCRIPTION =
  'Allow an AI tool to connect to the Sprecher East AI agent address.'

/** The answer past any limit of the AI agent address, as a message and as a token error */
export const TOO_MANY_REQUESTS = 'Too many requests. Try again in a minute.'

/** What a token request is sent as (RFC 6749 section 4.1.3), read by the route and passed on to the library */
export const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded'

/** Shown on the site, and by the approve button, when a request or approval cannot be trusted */
export const CONNECTION_REFUSED =
  'This connection request is no longer valid. Start it again from the AI tool.'

/** What an AI tool is told of a refusal: never the library's own message, which can name internals */
export const REFUSED_DESCRIPTION = 'The request was refused.'

/**
 * The only error names that leave this site, in a token answer or a redirect back to the tool:
 * RFC 6749 sections 4.1.2.1 and 5.2, and RFC 8707. Any other name, such as a library's own, is
 * answered as `server_error`.
 */
export const OAUTH_ERROR_NAMES: ReadonlySet<string> = new Set([
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unauthorized_client',
  'unsupported_grant_type',
  'unsupported_response_type',
  'invalid_scope',
  'invalid_target',
  'access_denied',
])

/** The grants a client may use; a refresh token is a grant of its own */
export const OAUTH_GRANTS = ['authorization_code', 'refresh_token'] as const

/** Sent with every answer that holds or refuses a token: nothing may keep it */
export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const

/** Sent with the discovery answers, which hold nothing secret: any client may read and cache them */
export const DISCOVERY_HEADERS = {
  'Cache-Control': 'public, max-age=300',
  'Access-Control-Allow-Origin': '*',
} as const

/** The two collections that hold the sign-ins (#1501) */
export const OAUTH_CLIENTS = 'oauth-clients' as const
export const OAUTH_TOKENS = 'oauth-tokens' as const
