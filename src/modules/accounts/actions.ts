'use server'

// Server actions are public endpoints: anyone can call them with any input
// (https://nextjs.org/docs/app/guides/data-security). Each one parses its input again and finds
// the account from the session, never from what the caller sends.

import { headers } from 'next/headers'

import { parseClientIp } from '@/platform/lib'
import { TurnstileVerifier } from '@/platform/turnstile/turnstileVerifier'

import {
  forgotPasswordSchema,
  passwordChangeSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verifyAccountSchema,
} from './domain/credentials'
import type {
  AccountSummary,
  ActionResult,
  ForgotPasswordFailure,
  PasswordFailure,
  ResetPasswordFailure,
  SignInFailure,
  SignUpFailure,
  VerifyAccountFailure,
} from './domain/types'
import { endSession } from './data/session'
import { changeOwnPassword } from './use-cases/changeOwnPassword'
import { getAccountSummary } from './use-cases/getAccountSummary'
import type { PublicRequest } from './use-cases/guardPublicRequest'
import { requestPasswordReset } from './use-cases/requestPasswordReset'
import { resetPasswordFromLink } from './use-cases/resetPasswordFromLink'
import { signInWithPassword } from './use-cases/signInWithPassword'
import { signUpResident } from './use-cases/signUpResident'
import { verifyAccountFromLink } from './use-cases/verifyAccountFromLink'

// The robot check on the public forms that send email (decision 0003)
const robotCheck = new TurnstileVerifier()

/** The robot-check token the form sent (anything else is none) and the connection's IP. */
async function toPublicRequest(robotCheckToken: unknown): Promise<PublicRequest> {
  const token = typeof robotCheckToken === 'string' ? robotCheckToken : null
  return { token, ip: parseClientIp(await headers()) }
}

/** Signs in with an email and password. Input that doesn't parse reads like a wrong password. */
export async function signIn(input: unknown): Promise<ActionResult<SignInFailure>> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return { ok: false, failure: 'wrong-credentials' }
  return signInWithPassword(parsed.data)
}

/** Signs out of this session and clears the auth cookie. */
export async function signOut(): Promise<void> {
  await endSession()
}

/**
 * Changes the signed-in account's own password, after checking its current one. There is no way
 * to name another account.
 */
export async function changePassword(input: unknown): Promise<ActionResult<PasswordFailure>> {
  const parsed = passwordChangeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, failure: 'rejected' }
  return changeOwnPassword(parsed.data)
}

/**
 * Emails a link to reset a forgotten password. `robotCheckToken` is the Turnstile token the form
 * got (#282). Input that doesn't parse, a failed robot check and too many requests are refused;
 * past those, the answer is the same whether or not an account uses the email.
 */
export async function forgotPassword(
  input: unknown,
  robotCheckToken?: unknown,
): Promise<ActionResult<ForgotPasswordFailure>> {
  const parsed = forgotPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, failure: 'rejected' }
  return requestPasswordReset(parsed.data, await toPublicRequest(robotCheckToken), robotCheck)
}

/** Sets a new password from a reset link's token. Input that doesn't parse is refused. */
export async function resetPassword(input: unknown): Promise<ActionResult<ResetPasswordFailure>> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, failure: 'rejected' }
  return resetPasswordFromLink(parsed.data)
}

/**
 * Creates a guest account and has Payload email its verification link (#187). The role is
 * always guest. `robotCheckToken` is the Turnstile token the form got (decision 0007). Input
 * that doesn't parse, a failed robot check and too many sign-ups are refused; past those, the
 * answer is the same whether or not an account already uses the email.
 */
export async function signUp(
  input: unknown,
  robotCheckToken?: unknown,
): Promise<ActionResult<SignUpFailure>> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, failure: 'rejected' }
  return signUpResident(parsed.data, await toPublicRequest(robotCheckToken), robotCheck)
}

/**
 * Verifies an account from its link's token, once the robot check passes (#303). Input that
 * doesn't parse is a dead link.
 */
export async function verifyAccount(
  input: unknown,
  robotCheckToken?: unknown,
): Promise<ActionResult<VerifyAccountFailure>> {
  const parsed = verifyAccountSchema.safeParse(input)
  if (!parsed.success) return { ok: false, failure: 'invalid-link' }
  const token = typeof robotCheckToken === 'string' ? robotCheckToken : null
  return verifyAccountFromLink(parsed.data, token, robotCheck)
}

/**
 * The header's view of who is signed in, or null. An action, not a server render, because most
 * pages are static and the header stays mounted across navigation.
 */
export async function getSignedInAccount(): Promise<AccountSummary | null> {
  return getAccountSummary()
}
