import type { PayloadRequest, Where } from 'payload'

import { OAUTH_TOKENS } from '../../domain/oauth/constants'

/** Set while a family is revoked, so the token hook does not run again for each row it changes. */
export const REVOKING_FAMILY = { revokingOAuthFamily: true } as const

/** Whether this request is already inside a family revocation. */
export const isRevokingFamily = (req: PayloadRequest): boolean =>
  req.context.revokingOAuthFamily === REVOKING_FAMILY.revokingOAuthFamily

/**
 * Revokes every credential of `where` that is not revoked yet, as of `at`. The one statement both
 * collections' hooks make (a client moved to another agent, a token revoked in Admin), always
 * with the flag the token hook looks for, so one revocation never starts another.
 */
export const revokeUnrevoked = (req: PayloadRequest, where: Where, at: string) =>
  req.payload.update({
    collection: OAUTH_TOKENS,
    where: { ...where, revokedAt: { exists: false } },
    data: { revokedAt: at },
    overrideAccess: true,
    req,
    context: REVOKING_FAMILY,
  })
