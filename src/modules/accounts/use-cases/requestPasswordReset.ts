import 'server-only'

import { after } from 'next/server'

import type { HumanVerifier } from '@/platform/lib'
import { runUseCase } from '@/platform/service'

import { sendResetLink } from '../data/passwordReset'
import type { ForgotPasswordValues } from '../domain/credentials'
import { RESET_REQUEST_LIMITS } from '../domain/requestLimits'
import type { ActionResult, ForgotPasswordFailure } from '../domain/types'
import { createRequestGuard, type PublicRequest } from './guardPublicRequest'

const guard = createRequestGuard('Password reset request', RESET_REQUEST_LIMITS)

/**
 * Emails a reset link if an account uses the email (#269). First the limits and the robot check
 * (#282); none of them depends on the email. Then the answer comes back at once and Payload runs
 * after the response (Next's `after()`), so an existing and an unknown email answer in the same
 * time, and the same way even when sending fails (docs/guidelines/security.md). A failure is
 * logged instead.
 */
export async function requestPasswordReset(
  values: ForgotPasswordValues,
  request: PublicRequest,
  verifier: HumanVerifier,
): Promise<ActionResult<ForgotPasswordFailure>> {
  const blocked = await guard(request, verifier)
  if (blocked) return { ok: false, failure: blocked }

  after(() => runUseCase('Password reset request', () => sendResetLink(values), undefined))
  return { ok: true }
}
