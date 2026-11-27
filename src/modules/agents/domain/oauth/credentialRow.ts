import type { TokenKind } from './constants'
import type { Credential } from './types'

type Ref = number | { id: number }

/** A row of the OAuth tokens collection, as Payload returns it with its client populated. */
export type CredentialRow = {
  id: number
  kind: TokenKind
  family: string
  client: number | { id: number; clientId?: string | null; enabled?: boolean | null }
  agent: Ref
  consentedBy?: Ref | null
  resource: string
  scope?: string | null
  expiresAt: string
  usedAt?: string | null
  revokedAt?: string | null
  redirectUri?: string | null
  codeChallenge?: string | null
}

const refId = (ref: Ref) => (typeof ref === 'object' ? ref.id : ref)
const date = (value: string | null | undefined) => (value ? new Date(value) : null)

/** The row as the rules read it; null when its client was not loaded (so it cannot be judged). */
export function toCredential(row: CredentialRow): Credential | null {
  if (typeof row.client !== 'object') return null
  return {
    id: row.id,
    kind: row.kind,
    family: row.family,
    client: {
      id: row.client.id,
      clientId: row.client.clientId ?? '',
      enabled: row.client.enabled !== false,
    },
    agentId: refId(row.agent),
    consentedBy: row.consentedBy ? refId(row.consentedBy) : null,
    resource: row.resource,
    scope: (row.scope ?? '').split(' ').filter(Boolean),
    expiresAt: new Date(row.expiresAt),
    usedAt: date(row.usedAt),
    revokedAt: date(row.revokedAt),
    redirectUri: row.redirectUri ?? null,
    codeChallenge: row.codeChallenge ?? null,
  }
}
