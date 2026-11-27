import { parseClientIp, SlidingWindowCounter } from '@/platform/lib'

import { OAUTH_REQUEST_LIMIT } from '../../domain/oauth/constants'

/**
 * A limit per connection for one address of the sign-in (#1501), counted in memory as the MCP
 * limits are: the site runs as one process. Each call makes a count of its own, so the token
 * address and the pages do not use each other's up. The answer is whether this request may go on;
 * a request that names no connection is not counted.
 */
export function createConnectionLimit(): (headers: Headers) => boolean {
  const attempts = new SlidingWindowCounter(
    OAUTH_REQUEST_LIMIT.windowMs,
    OAUTH_REQUEST_LIMIT.trackedConnections,
  )
  return (headers) => {
    const ip = parseClientIp(headers)
    return !ip || attempts.tryTake(ip, OAUTH_REQUEST_LIMIT.perConnection, Date.now())
  }
}
