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

/** Requests a minute to the token address from one connection (counted in memory, one process) */
export const OAUTH_TOKEN_LIMIT = {
  windowMs: 60 * 1000,
  perConnection: 30,
  trackedConnections: 2000,
}

/** Visits a minute to the authorize and approve pages from one connection: each reads the database */
export const OAUTH_AUTHORIZE_LIMIT = {
  windowMs: 60 * 1000,
  perConnection: 30,
  trackedConnections: 2000,
}

/** The grants a client may use; a refresh token is a grant of its own */
export const OAUTH_GRANTS = ['authorization_code', 'refresh_token'] as const

/** Sent with every answer that holds or refuses a token: nothing may keep it */
export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const

/** The two collections that hold the sign-ins (#1501) */
export const OAUTH_CLIENTS = 'oauth-clients' as const
export const OAUTH_TOKENS = 'oauth-tokens' as const
