// Connecting Google to an account that already has an email and password (#1338, decision 0020):
// the rules for the two ways in, and the fixed outcomes. Pure: no Payload, no Next.js.
//
// 1. At sign-in: Google's answer names an email an account uses, so the person enters that
//    account's password once (`use-cases/connectGoogle.ts`).
// 2. From the account page: a signed-in neighbor with a recent sign-in starts a link flow, and the
//    callback attaches the Google identity to that account only (`decideFinishLink`).

import { z } from 'zod'

import { MAX_PASSWORD_LENGTH } from './credentials'
import { isRecentSignIn } from './signInSession'

/** How long Google's checked answer waits for the password: the flow's own ten minutes. */
export const PENDING_LINK_TTL_MS = 10 * 60 * 1000

/** The collection that holds those answers. */
export const SOCIAL_LINK_REQUESTS = 'social-link-requests'

/** Where a signed-in neighbor starts connecting Google: a GET form posts here from `/account`. */
export const socialLinkPath = (provider: string) => `/auth/${provider}/link`

/** Where the password step is: the one page `/auth/google/callback` sends the person to. */
export const connectGooglePath = (provider: string) => `/auth/${provider}/connect`

/**
 * What the password step asks for. Strict, and no email: the account is the one whose email Google
 * verified, read from the stored record, never from input.
 */
export const connectGoogleSchema = z.strictObject({
  password: z.string().min(1, 'Enter your password').max(MAX_PASSWORD_LENGTH),
})

export type ConnectGoogleValues = z.output<typeof connectGoogleSchema>

/**
 * Why the password step didn't connect: too many tries from this connection, or one `failed` for
 * every other reason (a wrong password, a locked, unverified or agent account, a record that is
 * missing, used, expired or another browser's, a Google id already on an account), so no answer
 * says which check refused or whether an account exists.
 */
export type ConnectGoogleFailure = 'failed' | 'too-many'

/** How a connect from the account page ended, shown on `/account` as a fixed message. */
export type LinkResult = 'linked' | 'taken' | 'sign-in-again' | 'failed' | 'too-many'

/** Who may start a link from the account page: a signed-in account with a recent sign-in. */
export function decideStartLink({
  accountId,
  signedInAt,
  now,
}: {
  accountId: number | null
  signedInAt: Date | null
  now: Date
}): { ok: true } | { ok: false; result: Extract<LinkResult, 'sign-in-again'> } {
  return accountId !== null && isRecentSignIn(signedInAt, now)
    ? { ok: true }
    : { ok: false, result: 'sign-in-again' }
}

/** What the callback of a link flow may do. */
export type FinishLinkDecision =
  { kind: 'link' } | { kind: 'refuse'; result: Exclude<LinkResult, 'linked' | 'too-many'> }

/**
 * Whether Google's checked answer may be attached, asked again when the flow comes back (the
 * session may be gone or old by then). The account is the session's, and it must be the one that
 * started the flow, so a callback can't attach Google to another session's account. A Google
 * identity already on any account is refused, and so is one whose email Google didn't verify:
 * both ways of connecting obey the rule of `decideSocialSignIn`. `linkedAccountId` is who has this subject now.
 */
export function decideFinishLink({
  flowAccountId,
  session,
  linkedAccountId,
  emailVerified,
  now,
}: {
  flowAccountId: number
  session: { accountId: number; signedInAt: Date | null } | null
  linkedAccountId: number | null
  /** Whether Google says it confirmed the email: the same rule as signing in with Google */
  emailVerified: boolean
  now: Date
}): FinishLinkDecision {
  if (!session || !isRecentSignIn(session.signedInAt, now)) {
    return { kind: 'refuse', result: 'sign-in-again' }
  }
  if (session.accountId !== flowAccountId || !emailVerified) {
    return { kind: 'refuse', result: 'failed' }
  }
  if (linkedAccountId !== null) return { kind: 'refuse', result: 'taken' }
  return { kind: 'link' }
}
