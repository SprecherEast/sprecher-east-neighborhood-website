import type { Role } from '@/platform/lib'

/** Who is signed in, as pages and server actions need it. */
export type CurrentUser = {
  id: number
  email: string
  /** `null` when the account has no name */
  name: string | null
  role: Role
}

/** What the header shows for the signed-in account; nothing more about it leaves the server. */
export type AccountSummary = {
  name: string | null
  /** An admin or editor: the header links them to the admin (#378). Not the role itself */
  staff: boolean
}

/**
 * Why signing in failed. A wrong password, an unknown email and a locked account are all
 * `wrong-credentials`, so a visitor can't tell whether an account exists (#204).
 */
export type SignInFailure = 'wrong-credentials' | 'server-error'

/**
 * Why a password change failed: nobody signed in, the current password was refused (wrong, or
 * the account is locked: one code, #233), Payload refused the new one, or something broke.
 */
export type PasswordFailure = 'signed-out' | 'wrong-password' | 'rejected' | 'server-error'

/**
 * Why setting a password from a reset link failed: the link is unknown, used or expired (one
 * code), Payload refused the new password, or something broke.
 */
export type ResetPasswordFailure = 'invalid-link' | 'rejected' | 'server-error'

/**
 * Why asking for a reset link failed: input that doesn't parse, a failed robot check, or too many
 * requests (#282). None depends on the email: every request past them gets the same answer,
 * whether or not an account uses it (no enumeration, #269).
 */
export type ForgotPasswordFailure = 'rejected' | 'robot-check' | 'too-many'

/**
 * Why a sign-up failed (#187): input that doesn't parse, a failed robot check, or too many
 * sign-ups (from this connection or site-wide). None depends on the email: every request that
 * gets past them gets the same "check your email" answer, whether or not an account already uses
 * it.
 */
export type SignUpFailure = 'rejected' | 'robot-check' | 'too-many'

/**
 * Why opening a verification link failed: the link is unknown or already used (one code), the
 * link was resent after a second sign-up and needs the person to choose a password first (#289),
 * or something broke.
 */
export type VerifyAccountFailure =
  | 'already-verified'
  | 'invalid-link'
  | 'needs-password'
  | 'robot-check'
  | 'server-error'

/** What a server action that changes something returns. Failures are fixed codes, never text. */
export type { ActionResult } from '@/platform/lib'

/**
 * Where a verification link stands when its page opens (#391), read without changing anything:
 * `pending` still needs the Confirm button; the others show their message and no button.
 */
export type VerificationLinkStatus = 'pending' | 'already-verified' | 'invalid'
