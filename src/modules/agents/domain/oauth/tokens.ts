import type { TokenKind } from './constants'
import { resourceMatches } from './resource'

/** A stored credential, reduced to what decides whether it still counts. */
export type StoredToken = {
  kind: TokenKind
  expiresAt: Date
  /** Set when a code or refresh token was spent: a second use is a replay */
  usedAt?: Date | null
  revokedAt?: Date | null
  /** The audience it was issued for */
  resource: string
  /** The agent account the token acts as */
  agentId: number
  /** The client's own switch and the agent account it acts as now */
  client: { enabled: boolean; agentId: number }
}

export type TokenDenial =
  | 'wrong-kind'
  | 'used'
  | 'revoked'
  | 'expired'
  | 'wrong-audience'
  | 'client-disabled'
  | 'agent-changed'

/**
 * Why a credential may not be used now, or `null` when it may. `used` comes before `expired` and
 * `revoked` so that a replayed refresh token is always recognised as a replay, whatever its age.
 */
export function checkToken(
  token: StoredToken,
  expect: { kind: TokenKind; resource: string; now: Date },
): TokenDenial | null {
  if (token.kind !== expect.kind) return 'wrong-kind'
  if (token.usedAt) return 'used'
  if (token.revokedAt) return 'revoked'
  if (token.expiresAt.getTime() <= expect.now.getTime()) return 'expired'
  if (!resourceMatches(token.resource, expect.resource)) return 'wrong-audience'
  if (!token.client.enabled) return 'client-disabled'
  // A client moved to another agent account no longer vouches for what the old one was given
  if (token.agentId !== token.client.agentId) return 'agent-changed'
  return null
}
