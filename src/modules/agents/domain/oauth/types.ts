import type { Scope } from '../scopes'
import type { TokenKind } from './constants'

/** An AI tool an admin registered, as the sign-in rules need it. */
export type OAuthClient = {
  /** The collection's own id */
  id: number
  /** The public name the tool is given */
  clientId: string
  name: string
  redirectUris: string[]
  enabled: boolean
  /** The agent account every token of this client acts as */
  agentId: number
  /** What it may be given: a token carries at most these, and a change applies on the next call */
  scopes: Scope[]
  /** After this moment the client is refused, with every token it holds; null for none */
  expiresAt: Date | null
}

/**
 * A stored code, access token or refresh token: everything but the secret itself. A family is one
 * approval and everything issued from it, so a replay can end all of it at once.
 */
export type Credential = {
  id: number
  kind: TokenKind
  family: string
  client: Pick<OAuthClient, 'id' | 'clientId' | 'enabled' | 'agentId' | 'scopes' | 'expiresAt'>
  agentId: number
  consentedBy: number | null
  resource: string
  scope: string[]
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
  redirectUri: string | null
  codeChallenge: string | null
}

/** What both pages of a connection show of who is asking: the tool, and where it returns to. */
export type ClientFacts = {
  clientName: string
  /** Host and port of the address the sign-in returns to, shown so the admin can recognise it */
  redirectHost: string
}

/** The "user" the OAuth library carries from approval to token: who it acts as, and for what. */
export type Grantee = {
  agentId: number
  consentedBy: number | null
  resource: string
  family?: string
}

/** Who is looking at the consent page: the signed-in account, or nobody. */
export type Viewer = { id: number; isAdmin: boolean } | null
