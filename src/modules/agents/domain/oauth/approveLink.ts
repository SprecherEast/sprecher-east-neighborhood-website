import { OAUTH_PATHS } from './constants'
import type { ConsentRequest } from './consent'

/**
 * The address of the approval page for a request that has already been checked (#1501). The
 * first page an AI tool opens is reached from another site, where the browser withholds the
 * session, so it only passes the request on to this page, which is opened from our own site. The
 * query is the standard authorization request, so the same checks read it again. It holds the
 * request and nothing secret: an address anyone could write is no more than the tool's own.
 */
export function approvePath(request: ConsentRequest): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge,
    code_challenge_method: 'S256',
    state: request.state,
    resource: request.resource,
    scope: request.scope,
  })
  return `${OAUTH_PATHS.approve}?${query.toString()}`
}
