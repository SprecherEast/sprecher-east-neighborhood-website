import 'server-only'

import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { and, eq, isNull } from '@payloadcms/db-sqlite/drizzle'
import type { Payload } from 'payload'

import { OAUTH_TOKENS, type TokenKind } from '../../domain/oauth/constants'
import { toCredential } from '../../domain/oauth/credentialRow'
import { credentialByHash, revokedInFamily } from '../../domain/oauth/queries'
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
  const { docs } = await payload.find(credentialByHash(hashToken(secret, payload.secret)))
  return docs[0] ? toCredential(docs[0]) : null
}

/** Whether any row of the family has been revoked, which ends every row it holds or will hold. */
export async function isFamilyRevoked(payload: Payload, family: string): Promise<boolean> {
  const { docs } = await payload.find(revokedInFamily(family))
  return docs.length > 0
}

/** The adapter and the tokens table, for the two statements Payload's own API cannot make atomic. */
function tokensTable(payload: Payload) {
  const adapter = payload.db as unknown as SQLiteAdapter
  const table = adapter.tables.oauth_tokens
  if (!table) throw new Error('The OAuth tokens table is missing')
  return { adapter, table }
}

/**
 * Marks a code or refresh token as spent, and says whether this call was the one that did. One
 * UPDATE that only matches an unspent row, so two requests presenting the same credential at the
 * same moment cannot both win (a read and a write-back could let both through).
 */
export async function spendCredential(payload: Payload, credentialId: number): Promise<boolean> {
  const { adapter, table } = tokensTable(payload)
  const spent = await adapter.drizzle
    .update(table)
    .set({ usedAt: new Date().toISOString() })
    .where(and(eq(table.id, credentialId), isNull(table.usedAt)))
    .returning({ id: table.id })
  return spent.length === 1
}

/**
 * Ends everything issued from one approval: its code, access tokens and refresh tokens. One
 * UPDATE, so it is a single step the database cannot interleave with another request's insert:
 * every row saved before it is revoked by it, and a row saved after it finds the revoked ones
 * (`saveToken` looks, before and after saving). Payload's own `update` finds the rows and then
 * changes them one by one, which would leave a window for a row saved in between.
 */
export async function revokeFamily(payload: Payload, family: string): Promise<void> {
  const { adapter, table } = tokensTable(payload)
  const now = new Date().toISOString()
  await adapter.drizzle
    .update(table)
    .set({ revokedAt: now })
    .where(and(eq(table.family, family), isNull(table.revokedAt)))
}
