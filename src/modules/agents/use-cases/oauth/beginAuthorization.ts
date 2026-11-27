import 'server-only'

import {
  readAuthorizeRequest,
  readClientAndRedirect,
  type RawParams,
} from '../../domain/oauth/authorizeRequest'
import { signConsent, type ConsentRequest } from '../../domain/oauth/consent'
import { redirectError } from '../../domain/oauth/redirects'
import { redirectUriMatches } from '../../domain/oauth/redirectUri'
import type { Viewer } from '../../domain/oauth/types'
import { findOAuthClient } from '../../data/oauth/clients'
import { findAccountName, getOAuthContext } from '../../data/oauth/context'

export type ConsentView = {
  clientName: string
  /** Host and port of the address the sign-in returns to, shown so the admin can recognise it */
  redirectHost: string
  agentName: string | null
  request: ConsentRequest
  ticket: string
}

export type Beginning =
  /** The request cannot be trusted enough to send anything back: say so on the site */
  | { kind: 'refused'; message: string }
  /** The request is understood but wrong: tell the client */
  | { kind: 'redirect'; url: string }
  | { kind: 'sign-in-needed' }
  | { kind: 'admin-needed' }
  | { kind: 'consent'; view: ConsentView }

const REFUSED = 'This connection request is not valid. Start it again from the AI tool.'

/**
 * The consent page's request (#1501). In this order, so nothing is sent anywhere or asked of
 * anyone before it is safe: the client must be registered and on, the redirect address one of its
 * own, the request complete (PKCE S256, state, the MCP address as resource); only then is a
 * visitor asked to sign in, and only an admin is shown the approval.
 */
export async function beginAuthorization(params: RawParams, viewer: Viewer): Promise<Beginning> {
  const ids = readClientAndRedirect(params)
  if (!ids.ok) return { kind: 'refused', message: ids.message }
  const { payload, origin, resource } = await getOAuthContext()
  const client = await findOAuthClient(payload, ids.clientId)
  if (!client?.enabled || !redirectUriMatches(client.redirectUris, ids.redirectUri)) {
    return { kind: 'refused', message: REFUSED }
  }
  const read = readAuthorizeRequest(params, resource)
  if (!read.ok) {
    const state = typeof params.state === 'string' ? params.state : undefined
    return { kind: 'redirect', url: redirectError(ids.redirectUri, origin, read.error, state) }
  }
  if (!viewer) return { kind: 'sign-in-needed' }
  if (!viewer.isAdmin) return { kind: 'admin-needed' }
  return {
    kind: 'consent',
    view: {
      clientName: client.name,
      redirectHost: new URL(ids.redirectUri).host,
      agentName: await findAccountName(payload, client.agentId),
      request: read.request,
      ticket: signConsent(read.request, {
        adminId: viewer.id,
        now: new Date(),
        secret: payload.secret,
      }),
    },
  }
}
