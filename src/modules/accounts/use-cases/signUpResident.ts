import 'server-only'

import { after } from 'next/server'

import type { HumanVerifier } from '@/platform/lib'
import { logServerFailure, runUseCase } from '@/platform/service'

import { isRefusal } from '../data/failures'
import { createResidentAccount, deleteFailedSignUp, resendVerification } from '../data/signUp'
import type { SignUpValues } from '../domain/credentials'
import { SIGN_UP_LIMITS } from '../domain/requestLimits'
import type { ActionResult, SignUpFailure } from '../domain/types'
import { createRequestGuard, type PublicRequest } from './guardPublicRequest'

const guard = createRequestGuard('Sign-up', SIGN_UP_LIMITS)

/**
 * Creates a guest account, which Payload emails a verification link to (#187). First the
 * limits and the robot check (decision 0007); none of them depends on the email. Then every
 * request gets the same answer: an email an account already uses is refused by Payload and
 * answered like a new one, and a failure is logged rather than shown, as for a reset link (#269),
 * so no answer says whether an account exists (docs/guidelines/security.md).
 *
 * When that account isn't verified yet, its link is sent again, up to the resend cap (#289),
 * after the answer, so the reply takes no longer for it.
 */
export async function signUpResident(
  values: SignUpValues,
  request: PublicRequest,
  verifier: HumanVerifier,
): Promise<ActionResult<SignUpFailure>> {
  const blocked = await guard(request, verifier)
  if (blocked) return { ok: false, failure: blocked }

  const startedAt = new Date()
  try {
    await createResidentAccount(values)
  } catch (error) {
    // A refusal is an account that already uses the email: nothing to log or undo, but if it
    // isn't verified yet, its owner may have lost the first link
    if (isRefusal(error)) {
      after(() => resendLostLink(values.email))
      return { ok: true }
    }
    logServerFailure('Sign-up', error)
    // The account may be stored with its email unsent: remove it so the address isn't stuck
    await deleteFailedSignUp(values.email, startedAt).catch((cleanupError: unknown) =>
      logServerFailure('Sign-up cleanup', cleanupError),
    )
  }
  return { ok: true }
}

// Resends for the same address run one after another, so two sign-ups at once can't both read
// the count before either stores it and pass the cap together. In memory: the site runs as one
// PM2 process.
const resending = new Map<string, Promise<void>>()

/**
 * Resends the verification link if the account is unverified and under its cap; logs the rest.
 * Waits for any resend already running for this address.
 */
function resendLostLink(email: string): Promise<void> {
  const next = (resending.get(email) ?? Promise.resolve()).then(() => resendOnce(email))
  resending.set(email, next)
  void next.finally(() => {
    if (resending.get(email) === next) resending.delete(email)
  })
  return next
}

async function resendOnce(email: string): Promise<void> {
  const outcome = await runUseCase(
    'Sign-up verification resend',
    () => resendVerification(email, new Date()),
    null,
  )
  if (outcome === 'capped') console.warn('Sign-up verification resend capped for an account')
}
