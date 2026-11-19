import 'server-only'

import type { HumanVerifier } from '@/platform/lib'
import { runAction, runUseCase } from '@/platform/service'

import { toVerifyAccountFailure } from '../data/failures'
import {
  findPendingVerification,
  recordVerifiedToken,
  setPasswordFromVerification,
  verifyAccountToken,
  wasVerifiedWithToken,
} from '../data/signUp'
import type { VerifyAccountValues } from '../domain/credentials'
import type { ActionResult, VerifyAccountFailure } from '../domain/types'

/**
 * Verifies an account from its link (#187), once the robot check passes (#303): the page's
 * Confirm button sends its token, so a mail scanner that opens the link, or runs the page,
 * verifies nothing. An unknown or used link is one failure. A link resent
 * after a second sign-up needs a password first (#289): without one the answer is
 * `needs-password` and the token stays unused; with one, it replaces the account's password, then
 * the email is verified. Only the mailbox's owner holds the link, so only they set it.
 * Once verified, the link's hash is kept, so the same link pressed again answers
 * `already-verified` rather than a dead link (#391).
 */
export async function verifyAccountFromLink(
  { token, newPassword }: VerifyAccountValues,
  robotCheckToken: string | null,
  verifier: HumanVerifier,
): Promise<ActionResult<VerifyAccountFailure>> {
  if (verifier.isEnabled()) {
    const check = await verifier.verify(robotCheckToken)
    if (!check.ok) {
      console.warn(`Account verification robot check failed (${check.reason})`)
      return { ok: false, failure: 'robot-check' }
    }
  }
  return runAction<VerifyAccountFailure>(
    'Account verification',
    async () => {
      const pending = await findPendingVerification(token)
      if (!pending && (await wasVerifiedWithToken(token))) {
        return { ok: false, failure: 'already-verified' }
      }
      if (pending?.setsPassword) {
        if (!newPassword) return { ok: false, failure: 'needs-password' }
        await setPasswordFromVerification(pending.id, newPassword)
      }
      await verifyAccountToken({ token })
      if (pending) {
        // The account is verified either way; only the "already confirmed" answer is lost
        await runUseCase(
          'Recording a used verification link',
          () => recordVerifiedToken(pending.id, token),
          undefined,
        )
      }
      return { ok: true }
    },
    toVerifyAccountFailure,
  )
}
