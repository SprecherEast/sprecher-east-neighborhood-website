import 'server-only'

import { type HumanVerifier, SlidingWindowCounter } from '@/platform/lib'

import type { RequestLimits } from '../domain/requestLimits'

/** Who is asking: the robot-check token the form sent, and the connection's IP when known. */
export type PublicRequest = { token: string | null; ip: string | null }

/** Why a public request was turned away before it reached Payload. */
export type GuardFailure = 'robot-check' | 'too-many'

/**
 * The checks every public account form that sends email runs first, none of which depends on the
 * email: the per-connection limit, then the robot check (the same Turnstile check as the contact
 * form, decision 0003), then the site-wide limit. Answers the failure, or null to go ahead.
 * `name` is for the server log only.
 */
export function createRequestGuard(name: string, limits: RequestLimits) {
  const connections = new SlidingWindowCounter(limits.windowMs, limits.trackedConnections)
  // No site-wide limit means no site-wide counter: it would record every request for the window
  const site = limits.siteWide === undefined ? null : new SlidingWindowCounter(limits.windowMs)

  return async (
    { token, ip }: PublicRequest,
    verifier: HumanVerifier,
  ): Promise<GuardFailure | null> => {
    const now = Date.now()
    // Without a known IP the per-connection limit can't apply; the site-wide one still does
    if (ip && !connections.tryTake(ip, limits.perConnection, now)) return 'too-many'

    if (verifier.isEnabled()) {
      const check = await verifier.verify(token)
      if (!check.ok) {
        console.warn(`${name} robot check failed (${check.reason})`)
        return 'robot-check'
      }
    }

    if (site && limits.siteWide !== undefined && !site.tryTake('site', limits.siteWide, now)) {
      console.warn(`${name} hit the site-wide hourly limit`)
      return 'too-many'
    }
    return null
  }
}
