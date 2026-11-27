import { z } from 'zod'

/**
 * What the approve and deny buttons send (#1501). A server action is a public endpoint, so the
 * input is parsed again: strings of sane length and nothing else. Whether it is genuine is the
 * ticket's job (`verifyConsent`), not this schema's.
 */
export const consentInputSchema = z.object({
  request: z.object({
    clientId: z.string().min(1).max(200),
    redirectUri: z.string().min(1).max(2000),
    state: z.string().min(1).max(512),
    codeChallenge: z.string().min(43).max(128),
    resource: z.string().min(1).max(2000),
    scope: z.string().min(1).max(100),
  }),
  ticket: z.string().min(1).max(200),
  decision: z.enum(['approve', 'deny']),
})
