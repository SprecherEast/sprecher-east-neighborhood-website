import 'server-only'

import { randomUUID } from 'node:crypto'

import OAuth2Server from '@node-oauth/oauth2-server'
import type {
  AuthorizationCode,
  AuthorizationCodeModel,
  Client,
  RefreshToken,
  RefreshTokenModel,
  Token,
} from '@node-oauth/oauth2-server'
import type { Payload } from 'payload'

import { OAUTH_GRANTS, OAUTH_LIFETIMES, OAUTH_SCOPE } from '../../domain/oauth/constants'
import { redirectUriMatches } from '../../domain/oauth/redirectUri'
import { generateToken } from '../../domain/oauth/secrets'
import { checkToken } from '../../domain/oauth/tokens'
import type { Credential, Grantee } from '../../domain/oauth/types'
import { findOAuthClient, isAgentAccount } from './clients'
import {
  findCredential,
  isFamilyRevoked,
  revokeFamily,
  saveCredential,
  spendCredential,
} from './credentials'

/** The answer when the approval these tokens would come from was ended by a replay */
const ended = () => new OAuth2Server.InvalidGrantError('Invalid grant: the grant has ended')

type Model = AuthorizationCodeModel & RefreshTokenModel
/** A stored credential handed to the library and handed back to us, with the row it came from */
type WithRow<T> = T & { credentialId: number }

const grantee = (c: Credential): Grantee => ({
  agentId: c.agentId,
  consentedBy: c.consentedBy,
  resource: c.resource,
  family: c.family,
})

/**
 * What `@node-oauth/oauth2-server` asks of storage, answered from the two OAuth collections
 * (#1501). The library decides the protocol (PKCE, expiry, redirect and client checks, error
 * codes); this decides what is remembered, and enforces the three rules the library leaves to its
 * model: a credential is spent atomically, a spent one used again ends its family, and a token's
 * audience and client must still be valid.
 *
 * The library's "user" is a `Grantee`: the agent account the tool acts as, the admin who approved,
 * the audience, and the family. Credentials are generated here so each carries its kind's prefix.
 */
export function createOAuthModel(payload: Payload, expectedResource: string): Model {
  /** The credential if it may be used now; a replay ends its whole family. */
  const usable = async (
    secret: string,
    kind: 'code' | 'refresh',
  ): Promise<Credential | null> => {
    const found = await findCredential(payload, secret)
    if (!found || found.kind !== kind) return null
    const denial = checkToken(found, { kind, resource: expectedResource, now: new Date() })
    if (denial === 'used') await revokeFamily(payload, found.family)
    if (denial) return null
    if (await isFamilyRevoked(payload, found.family)) return null
    return (await isAgentAccount(payload, found.agentId)) ? found : null
  }

  const clientOf = (c: Credential): Client => ({
    id: c.client.clientId,
    grants: [...OAUTH_GRANTS],
  })

  return {
    async getClient(clientId) {
      const client = await findOAuthClient(payload, clientId)
      if (!client?.enabled) return false
      return {
        id: client.clientId,
        grants: [...OAUTH_GRANTS],
        redirectUris: client.redirectUris,
        credentialClientId: client.id,
        agentId: client.agentId,
      }
    },

    async validateRedirectUri(redirectUri, client) {
      return redirectUriMatches(client.redirectUris as string[], redirectUri)
    },

    async validateScope(_user, _client, scope) {
      const wanted = scope ?? []
      return wanted.every((s) => s === OAUTH_SCOPE) ? [OAUTH_SCOPE] : false
    },

    generateAuthorizationCode: async () => generateToken('code'),
    generateAccessToken: async () => generateToken('access'),
    generateRefreshToken: async () => generateToken('refresh'),

    async saveAuthorizationCode(code, client, user) {
      const who = user as Grantee
      await saveCredential(payload, {
        kind: 'code',
        secret: code.authorizationCode,
        family: randomUUID(),
        clientId: client.credentialClientId as number,
        agentId: who.agentId,
        consentedBy: who.consentedBy,
        resource: who.resource,
        scope: code.scope ?? [OAUTH_SCOPE],
        expiresAt: code.expiresAt,
        redirectUri: code.redirectUri,
        codeChallenge: code.codeChallenge,
      })
      return { ...code, client, user } as AuthorizationCode
    },

    async getAuthorizationCode(secret) {
      const found = await usable(secret, 'code')
      if (!found) return false
      return {
        authorizationCode: secret,
        expiresAt: found.expiresAt,
        redirectUri: found.redirectUri ?? '',
        scope: found.scope,
        client: clientOf(found),
        user: grantee(found),
        codeChallenge: found.codeChallenge ?? undefined,
        codeChallengeMethod: 'S256',
        credentialId: found.id,
      } as WithRow<AuthorizationCode>
    },

    async revokeAuthorizationCode(code) {
      const row = code as WithRow<AuthorizationCode>
      const won = await spendCredential(payload, row.credentialId)
      // Losing means another request spent this code a moment ago: a replay, so the family ends
      if (!won) await revokeFamily(payload, (code.user as Grantee).family ?? '')
      return won
    },

    async saveToken(token, client, user) {
      const who = user as Grantee
      const family = who.family ?? randomUUID()
      const base = {
        family,
        clientId: client.credentialClientId as number,
        agentId: who.agentId,
        consentedBy: who.consentedBy,
        resource: who.resource,
        scope: token.scope ?? [OAUTH_SCOPE],
      }
      // A family that has ended takes no new row, and one that ends while these are saved loses
      // them: the revocation is one UPDATE (`revokeFamily`), so either it ran first and the
      // second look finds it, or it ran later and covered these rows. The tool gets no tokens.
      if (await isFamilyRevoked(payload, family)) throw ended()
      await saveCredential(payload, {
        ...base,
        kind: 'access',
        secret: token.accessToken,
        expiresAt:
          token.accessTokenExpiresAt ??
          new Date(Date.now() + OAUTH_LIFETIMES.accessSeconds * 1000),
      })
      if (token.refreshToken && token.refreshTokenExpiresAt) {
        await saveCredential(payload, {
          ...base,
          kind: 'refresh',
          secret: token.refreshToken,
          expiresAt: token.refreshTokenExpiresAt,
        })
      }
      if (await isFamilyRevoked(payload, family)) {
        await revokeFamily(payload, family)
        throw ended()
      }
      const saved: Token = {
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        scope: token.scope,
        client,
        user: { ...who, family },
      }
      return saved
    },

    async getRefreshToken(secret) {
      const found = await usable(secret, 'refresh')
      if (!found) return false
      return {
        refreshToken: secret,
        refreshTokenExpiresAt: found.expiresAt,
        scope: found.scope,
        client: clientOf(found),
        user: grantee(found),
        credentialId: found.id,
      } as WithRow<RefreshToken>
    },

    async revokeToken(token) {
      const row = token as WithRow<RefreshToken>
      const won = await spendCredential(payload, row.credentialId)
      // Losing means another request spent it a moment ago: a replay, so the family ends
      if (!won) await revokeFamily(payload, (token.user as Grantee).family ?? '')
      return won
    },

    // Our own check authenticates MCP requests (cms/oauth/authenticateBearer.ts)
    async getAccessToken() {
      return false
    },
  }
}
