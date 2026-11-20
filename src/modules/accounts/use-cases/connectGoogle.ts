import 'server-only'

import { after } from 'next/server'

import { logServerFailure, runUseCase } from '@/platform/service'

import { sendEmailToAccount } from '../data/accountEmail'
import { getSignInSession, isPasswordFor, startSessionFor } from '../data/session'
import {
  findAccountByEmail,
  findAccountBySubject,
  hasLinkedSubject,
  linkSubject,
} from '../data/socialAccounts'
import {
  isPendingLinkOpen,
  readPendingLinkCookie,
  takePendingLink,
  takePendingLinkCookie,
} from '../data/socialLinkRequests'
import { toGoogleConnectedEmail } from '../domain/googleConnectedEmail'
import {
  decideFinishLink,
  decideStartLink,
  type ConnectGoogleFailure,
  type ConnectGoogleValues,
  type LinkResult,
} from '../domain/googleLink'
import { ACCOUNT_PATH } from '../domain/paths'
import { SOCIAL_SIGN_IN_LIMITS } from '../domain/requestLimits'
import type { ActionResult } from '../domain/types'
import {
  canSignInTo,
  enabledProviders,
  SOCIAL_RESULT_PARAM,
  type SocialProfile,
  type SocialProvider,
} from '../domain/socialSignIn'
import { createRequestGuard, NO_ROBOT_CHECK } from './guardPublicRequest'

// Connecting Google to an account that already has an email and password (#1338, decision 0020),
// the two ways in. Both end in `linkSubject`, which writes the link only while the account has
// none. Nothing is linked by an email alone, and Google without the password never signs in to
// the existing account.

/** Back to the account page with how the connect ended: a fixed code, never Google's text. */
export const toAccount = (result: LinkResult) => `${ACCOUNT_PATH}?${SOCIAL_RESULT_PARAM}=${result}`

// The password step counts per connection, like every other step of a provider sign-in
const passwordGuard = createRequestGuard('Google connect', SOCIAL_SIGN_IN_LIMITS)

const FAILED = { ok: false, failure: 'failed' } as const

/**
 * What the account page's card shows: nothing when Google is off, "connected" when the account
 * has a Google identity, otherwise the button. The account is the page's, from the session.
 */
export async function getGoogleConnection(
  accountId: number,
): Promise<'off' | 'connected' | 'available'> {
  if (!enabledProviders(process.env).includes('google')) return 'off'
  return (await hasLinkedSubject(accountId, 'google')) ? 'connected' : 'available'
}

/**
 * Starting a link from the account page: the session must be a recent sign-in, and an account
 * that already has Google has nothing to connect. Answers the account the flow is bound to, or
 * where to send the person instead.
 */
export async function beginGoogleLink(
  provider: SocialProvider,
  now: Date,
): Promise<{ ok: true; accountId: number } | { ok: false; to: string }> {
  const session = await getSignInSession()
  const decision = decideStartLink({
    accountId: session?.accountId ?? null,
    signedInAt: session?.signedInAt ?? null,
    now,
  })
  if (!decision.ok || !session) return { ok: false, to: toAccount('sign-in-again') }
  if (await hasLinkedSubject(session.accountId, provider)) return { ok: false, to: ACCOUNT_PATH }
  return { ok: true, accountId: session.accountId }
}

/**
 * Finishing a link from the account page, once Google's answer is checked. The account is the
 * session's, never the flow's alone: the flow's account must match it, the sign-in must still be
 * recent, and the Google identity must be on no account. Answers where to send the person.
 */
export async function finishGoogleLink(
  flowAccountId: number,
  profile: SocialProfile,
  now: Date,
): Promise<string> {
  try {
    const session = await getSignInSession()
    const linked = await findAccountBySubject(profile.provider, profile.subject)
    const decision = decideFinishLink({
      flowAccountId,
      session: session && { accountId: session.accountId, signedInAt: session.signedInAt },
      linkedAccountId: linked?.id ?? null,
      now,
    })
    if (decision.kind === 'refuse' || !session)
      return toAccount(decision.kind === 'refuse' ? decision.result : 'failed')
    if (!(await linkSubject(session.accountId, profile.provider, profile.subject))) {
      return toAccount('failed')
    }
    notifyConnected(session.email)
    return toAccount('linked')
  } catch (error) {
    logServerFailure(`${profile.provider} connect`, error)
    return toAccount('failed')
  }
}

/** Whether this browser still holds a pending link the password step can use, for its page. */
export async function hasPendingGoogleLink(): Promise<boolean> {
  const now = new Date()
  const id = await readPendingLinkCookie(now)
  return id !== null && (await isPendingLinkOpen(id, now))
}

/**
 * The password step at sign-in: connects Google to the account whose email Google verified, once
 * its password checks out, and signs the person in. Order matters:
 *  1. The per-connection limit, before anything is read.
 *  2. The pending record is taken once from this browser's cookie, whatever else is wrong, so a
 *     wrong password or a copy of the cookie uses it up and Google has to be asked again.
 *  3. The password goes through Payload's own login, as the sign-in form does: its lockout
 *     counts a wrong one (#140) and it refuses a locked, unverified or agent account.
 *  4. The link is written only while the account has none and the Google identity is on no
 *     other account; only then the session starts.
 * Every refusal is one `failed`, so no answer says which check refused or whether an account
 * exists. The account is read from the record's verified email, never from input.
 */
export function connectGoogleWithPassword(
  { password }: ConnectGoogleValues,
  ip: string | null,
): Promise<ActionResult<ConnectGoogleFailure>> {
  return runUseCase<ActionResult<ConnectGoogleFailure>>(
    'Google connect',
    () => connect(password, ip),
    FAILED,
  )
}

async function connect(
  password: string,
  ip: string | null,
): Promise<ActionResult<ConnectGoogleFailure>> {
  if (await passwordGuard({ token: null, ip }, NO_ROBOT_CHECK)) {
    return { ok: false, failure: 'too-many' }
  }
  const now = new Date()
  const id = await takePendingLinkCookie(now)
  const pending = id === null ? null : await takePendingLink(id, now)
  if (!pending) return FAILED

  if (!(await isPasswordFor(pending.email, password))) return FAILED
  const account = await findAccountByEmail(pending.email)
  if (!account || !canSignInTo(account, now)) return FAILED
  if (await findAccountBySubject(pending.provider, pending.subject)) return FAILED
  if (!(await linkSubject(account.id, pending.provider, pending.subject))) return FAILED

  await startSessionFor(account.id)
  notifyConnected(pending.email)
  return { ok: true }
}

/** The note to the account's address, after the link is stored: a failed send is only logged. */
function notifyConnected(to: string): void {
  const at = new Date()
  after(() =>
    runUseCase(
      'Google connected note',
      () => sendEmailToAccount(to, toGoogleConnectedEmail({ at })),
      undefined,
    ),
  )
}
