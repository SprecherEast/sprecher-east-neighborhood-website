import 'server-only'

import { readAuthorizeRequest, toAuthorizeParams } from '../../domain/oauth/authorizeRequest'
import { verifyConsent, type ConsentRequest } from '../../domain/oauth/consent'
import {
  CONNECTION_REFUSED,
  OAUTH_ERROR_NAMES,
  REFUSED_DESCRIPTION,
} from '../../domain/oauth/constants'
import { redirectBack, redirectError } from '../../domain/oauth/redirects'
import { clientAccepts } from '../../domain/oauth/redirectUri'
import type { Grantee, Viewer } from '../../domain/oauth/types'
import { recordAllows, scopeList } from '../../domain/scopes'
import { findOAuthClient } from '../../data/oauth/clients'
import { getOAuthContext } from '../../data/oauth/context'
import { createOAuthServer, OAuthError, OAuthRequest, OAuthResponse } from './oauthServer'

export type Decision = 'approve' | 'deny'
export type Decided = { kind: 'redirect'; url: string } | { kind: 'refused'; message: string }

const REFUSED: Decided = { kind: 'refused', message: CONNECTION_REFUSED }

/**
 * The approve or deny button (#1501). Everything the page showed is checked again, because a
 * button press is a request anyone could forge: the viewer must be a signed-in admin right now,
 * the ticket must be this admin's, unexpired and for exactly this request, and the client and
 * its redirect address must still be registered. Only then does the OAuth library make a code,
 * bound to the PKCE challenge, the redirect address and the MCP address.
 */
export async function decideConsent(
  request: ConsentRequest,
  ticket: string,
  decision: Decision,
  viewer: Viewer,
): Promise<Decided> {
  if (!viewer?.isAdmin) return REFUSED
  const { payload, origin, resource } = await getOAuthContext()
  const now = new Date()
  if (!verifyConsent(ticket, request, { adminId: viewer.id, now, secret: payload.secret })) {
    return REFUSED
  }
  const client = await findOAuthClient(payload, request.clientId)
  if (!clientAccepts(client, request.redirectUri, now)) {
    return REFUSED
  }
  const params = toAuthorizeParams(request)
  // The same rules as the page, so a ticket for a request that no longer passes them is refused
  if (!readAuthorizeRequest(params, resource).ok) return REFUSED
  // The record may have been narrowed since the page was shown: no cached grants
  if (!recordAllows(scopeList(request.scope), client.scopes)) return REFUSED
  if (decision === 'deny') {
    const error = {
      code: 'access_denied',
      description: 'An admin did not approve the connection.',
    } as const
    return {
      kind: 'redirect',
      url: redirectError(request.redirectUri, origin, error, request.state),
    }
  }

  const grantee: Grantee = { agentId: client.agentId, consentedBy: viewer.id, resource }
  const response = new OAuthResponse()
  try {
    const code = await createOAuthServer(payload, resource).authorize(
      new OAuthRequest({ headers: {}, method: 'GET', query: params, body: {} }),
      response,
      { authenticateHandler: { handle: async () => grantee } },
    )
    return {
      kind: 'redirect',
      url: redirectBack(request.redirectUri, origin, {
        code: code.authorizationCode,
        state: request.state,
      }),
    }
  } catch (error) {
    // Never the library's own message: it can name internals. The client hears a plain code
    const code =
      error instanceof OAuthError && OAUTH_ERROR_NAMES.has(error.name) ? error.name : 'server_error'
    const description =
      code === 'server_error' ? 'The server could not finish the sign-in.' : REFUSED_DESCRIPTION
    return {
      kind: 'redirect',
      url: redirectError(request.redirectUri, origin, { code, description }, request.state),
    }
  }
}
