import { z } from 'zod'

import { REQUEST_LIMITS } from './authorizeRequest'

/**
 * What the approve and deny buttons send (#1501). A server action is a public endpoint, so the
 * input is parsed again: strings of sane length and nothing else. Whether it is genuine is the
 * ticket's job (`verifyConsent`), not this schema's.
 */
export const consentInputSchema = z.object({
  request: z.object({
    clientId: z.string().min(1).max(REQUEST_LIMITS.clientId),
    redirectUri: z.string().min(1).max(REQUEST_LIMITS.redirectUri),
    state: z.string().min(1).max(REQUEST_LIMITS.state),
    codeChallenge: z.string().min(REQUEST_LIMITS.challenge.min).max(REQUEST_LIMITS.challenge.max),
    resource: z.string().min(1).max(2000),
    scope: z.string().min(1).max(100),
  }),
  ticket: z.string().min(1).max(200),
  decision: z.enum(['approve', 'deny']),
})
