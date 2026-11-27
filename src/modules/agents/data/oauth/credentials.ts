import 'server-only'

import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { and, eq, isNull } from '@payloadcms/db-sqlite/drizzle'
import type { Payload } from 'payload'

import { OAUTH_TOKENS, type TokenKind } from '../../domain/oauth/constants'
import { toCredential } from '../../domain/oauth/credentialRow'
import { hashToken } from '../../domain/oauth/secrets'
import type { Credential } from '../../domain/oauth/types'

export type NewCredential = {
  kind: TokenKind
  /** The secret as given to the client; only its hash is stored */
  secret: string
  family: string
  clientId: number
  agentId: number
  consentedBy: number | null
  resource: string
  scope: string[]
  expiresAt: Date
  redirectUri?: string
  codeChallenge?: string
}

export async function saveCredential(payload: Payload, c: NewCredential): Promise<void> {
  await payload.create({
    collection: OAUTH_TOKENS,
    data: {
      kind: c.kind,
      tokenHash: hashToken(c.secret, payload.secret),
      family: c.family,
      client: c.clientId,
      agent: c.agentId,
      consentedBy: c.consentedBy,
      resource: c.resource,
      scope: c.scope.join(' '),
      expiresAt: c.expiresAt.toISOString(),
      redirectUri: c.redirectUri,
      codeChallenge: c.codeChallenge,
    },
    depth: 0,
    overrideAccess: true,
  })
}

/** The stored credential for a secret a client presented, or null. Also the client's state. */
export async function findCredential(
  payload: Payload,
  secret: string,
): Promise<Credential | null> {
  const { docs } = await payload.find({
    collection: OAUTH_TOKENS,
    where: { tokenHash: { equals: hashToken(secret, payload.secret) } },
    limit: 1,
    depth: 1,
    pagination: false,
    populate: { 'oauth-clients': { clientId: true, enabled: true } },
    overrideAccess: true,
  })
  return docs[0] ? toCredential(docs[0]) : null
}

/**
 * Marks a code or refresh token as spent, and says whether this call was the one that did. One
 * UPDATE that only matches an unspent row, so two requests presenting the same credential at the
 * same moment cannot both win (a read and a write-back could let both through).
 */
export async function spendCredential(payload: Payload, credentialId: number): Promise<boolean> {
  const adapter = payload.db as unknown as SQLiteAdapter
  const table = adapter.tables.oauth_tokens
  if (!table) throw new Error('The OAuth tokens table is missing')
  const spent = await adapter.drizzle
    .update(table)
    .set({ usedAt: new Date().toISOString() })
    .where(and(eq(table.id, credentialId), isNull(table.usedAt)))
    .returning({ id: table.id })
  return spent.length === 1
}

/** Ends everything issued from one approval: its code, access tokens and refresh tokens. */
export async function revokeFamily(payload: Payload, family: string): Promise<void> {
  await payload.update({
    collection: OAUTH_TOKENS,
    where: { family: { equals: family }, revokedAt: { exists: false } },
    data: { revokedAt: new Date().toISOString() },
    depth: 0,
    overrideAccess: true,
    context: { revokingOAuthFamily: true },
  })
}
