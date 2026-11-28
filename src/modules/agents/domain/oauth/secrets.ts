import { createHmac, randomBytes } from 'node:crypto'

import { TOKEN_PREFIX, type TokenKind } from './constants'

/** A new credential: a fixed prefix and 256 random bits. Only its hash is ever stored. */
export const generateToken = (kind: TokenKind): string =>
  `${TOKEN_PREFIX[kind]}${randomBytes(32).toString('base64url')}`

/** The public name of an OAuth client the admin registers: what Claude is given as its client ID. */
export const generateClientId = (): string => `mcp_${randomBytes(16).toString('hex')}`

/** Which kind of credential this is, from its prefix; `null` for an API key or anything else. */
export function tokenKindOf(token: string): TokenKind | null {
  const found = (Object.keys(TOKEN_PREFIX) as TokenKind[]).find((kind) =>
    token.startsWith(TOKEN_PREFIX[kind]),
  )
  return found ?? null
}

/**
 * What is stored in place of a credential: an HMAC with the site's secret, as the MCP plugin
 * stores API keys. The credentials are random and long, so a keyed hash is enough, and a copy of
 * the database alone cannot be used or checked offline.
 */
export function hashToken(token: string, secret: string): string {
  if (!secret) throw new Error('A site secret is needed to hash a token')
  return createHmac('sha256', secret).update(token).digest('hex')
}
