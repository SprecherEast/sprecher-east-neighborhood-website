import 'server-only'

import OAuth2Server from '@node-oauth/oauth2-server'
import type { Payload } from 'payload'

import { createOAuthModel } from '../../data/oauth/model'
import { OAUTH_LIFETIMES } from '../../domain/oauth/constants'

export const { Request: OAuthRequest, Response: OAuthResponse, OAuthError } = OAuth2Server

/**
 * The protocol engine, `@node-oauth/oauth2-server` (#1501), set as strictly as it goes: PKCE is
 * required and only S256 (`plain` is off by default), a state is required, every use of a refresh
 * token issues a new one, and no client has to send a secret because each is a public client.
 * Bearer tokens are never read from a query string.
 */
export const createOAuthServer = (payload: Payload, resource: string) =>
  new OAuth2Server({
    model: createOAuthModel(payload, resource),
    accessTokenLifetime: OAUTH_LIFETIMES.accessSeconds,
    refreshTokenLifetime: OAUTH_LIFETIMES.refreshSeconds,
    authorizationCodeLifetime: OAUTH_LIFETIMES.codeSeconds,
    requirePKCE: true,
    allowEmptyState: false,
    alwaysIssueNewRefreshToken: true,
    requireClientAuthentication: { authorization_code: false, refresh_token: false },
    allowBearerTokensInQueryString: false,
  })
