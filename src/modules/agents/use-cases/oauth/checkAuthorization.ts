import 'server-only'

import { parseClientIp, SlidingWindowCounter } from '@/platform/lib'

import {
  readAuthorizeRequest,
  readClientAndRedirect,
  type RawParams,
} from '../../domain/oauth/authorizeRequest'
import { OAUTH_AUTHORIZE_LIMIT } from '../../domain/oauth/constants'
import type { ConsentRequest } from '../../domain/oauth/consent'
import { redirectError } from '../../domain/oauth/redirects'
import { clientAccepts } from '../../domain/oauth/redirectUri'
import { findOAuthClient } from '../../data/oauth/clients'
import { getOAuthContext } from '../../data/oauth/context'

// In memory, as the MCP and token limits are: the site runs as one process
const visits = new SlidingWindowCounter(
  OAUTH_AUTHORIZE_LIMIT.windowMs,
  OAUTH_AUTHORIZE_LIMIT.trackedConnections,
)

export type Checked =
  /** The request cannot be trusted enough to send anything back: say so on the site */
  | { kind: 'refused'; message: string }
  /** The request is understood but wrong: tell the client */
  | { kind: 'redirect'; url: string }
  | { kind: 'too-many' }
  | {
      kind: 'ok'
      request: ConsentRequest
      clientName: string
      agentId: number
      redirectHost: string
    }

const REFUSED = 'This connection request is not valid. Start it again from the AI tool.'

/**
 * What both pages of the connection do first (#1501), in this order, so nothing is sent anywhere
 * or asked of anyone before it is safe: a limit per connection (each visit reads the database);
 * the client must be registered and on, the redirect address one of its own, and the request
 * complete (PKCE S256, state, the MCP address as resource). Reads no session.
 */
export async function checkAuthorization(params: RawParams, headers: Headers): Promise<Checked> {
  const ip = parseClientIp(headers)
  if (ip && !visits.tryTake(ip, OAUTH_AUTHORIZE_LIMIT.perConnection, Date.now())) {
    return { kind: 'too-many' }
  }
  const ids = readClientAndRedirect(params)
  if (!ids.ok) return { kind: 'refused', message: ids.message }
  const { payload, origin, resource } = await getOAuthContext()
  const client = await findOAuthClient(payload, ids.clientId)
  if (!clientAccepts(client, ids.redirectUri)) {
    return { kind: 'refused', message: REFUSED }
  }
  const read = readAuthorizeRequest(params, resource)
  if (!read.ok) {
    const state = typeof params.state === 'string' ? params.state : undefined
    return { kind: 'redirect', url: redirectError(ids.redirectUri, origin, read.error, state) }
  }
  return {
    kind: 'ok',
    request: read.request,
    clientName: client.name,
    agentId: client.agentId,
    redirectHost: new URL(ids.redirectUri).host,
  }
}
