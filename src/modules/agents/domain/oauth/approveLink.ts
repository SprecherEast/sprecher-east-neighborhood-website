import { toAuthorizeParams } from './authorizeRequest'
import { OAUTH_PATHS } from './constants'
import type { ConsentRequest } from './consent'

/**
 * The address of the approval page for a request that has already been checked (#1501). The
 * first page an AI tool opens is reached from another site and reads no session, so it only passes
 * the request on to this page, opened from this site; the approval ignores a session from another
 * site (`isFromAnotherSite`). The query is the standard authorization request, so the same checks
 * read it again. It holds the request and nothing secret: an address anyone could write is no
 * more than the tool's own.
 */
export function approvePath(request: ConsentRequest): string {
  const query = new URLSearchParams(toAuthorizeParams(request))
  return `${OAUTH_PATHS.approve}?${query.toString()}`
}
