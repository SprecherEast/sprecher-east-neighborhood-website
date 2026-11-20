import 'server-only'

import { after } from 'next/server'

import { runUseCase } from '@/platform/service'

import { sendEmailToAccount } from '../data/accountEmail'
import { takeChallenge, createChallenge } from '../data/passkeyChallenges'
import { saveChallengeCookie, takeChallengeCookie } from '../data/passkeyChallengeCookie'
import { getPasskeyRelyingParty } from '../data/passkeySettings'
import { countPasskeys, getOrCreateUserHandle, listPasskeys, savePasskey } from '../data/passkeys'
import { getSignInSession, type SignInSession } from '../data/session'
import { makeRegistrationOptions, verifyNewPasskey } from '../data/webauthn'
import type {
  AddPasskeyFailure,
  AddPasskeyInput,
  StartAddPasskeyResult,
} from '../domain/addPasskey'
import { toPasskeyAddedEmail } from '../domain/passkeyEmail'
import { decideAddPasskey, DEFAULT_PASSKEY_LABEL, toPasskeyLabel } from '../domain/passkeys'
import { PASSKEY_OPTIONS_LIMITS } from '../domain/requestLimits'
import type { ActionResult } from '../domain/types'
import { createRequestGuard, NO_ROBOT_CHECK } from './guardPublicRequest'

// Adding a passkey from the account page (#1314, decision 0021): two steps, each asking again who
// the session belongs to. The account always comes from the session, never from input. Every
// reason that isn't "sign in again", "too many" or "the most passkeys" is one `failed`, and the
// WebAuthn library is reached only through `data/webauthn.ts`.

const optionsGuard = createRequestGuard('Passkey options', PASSKEY_OPTIONS_LIMITS)

const FAILED = { ok: false, failure: 'failed' } as const

/** Whether the add-a-passkey card may show: the switch is on and the site address can be a relying party. */
export function arePasskeysOn(): boolean {
  return getPasskeyRelyingParty() !== null
}

/**
 * Why this session may not add one more passkey now, or null: not signed in or not recent (both
 * mean signing in again), or the cap. Counts the account's passkeys at this moment.
 */
async function refusal(
  session: SignInSession | null,
  now: Date,
): Promise<Exclude<AddPasskeyFailure, 'too-many' | 'failed'> | null> {
  const decision = decideAddPasskey({
    accountId: session?.accountId ?? null,
    existingCount: session ? await countPasskeys(session.accountId) : 0,
    signedInAt: session?.signedInAt ?? null,
    now,
  })
  if (decision.ok) return null
  return decision.reason === 'cap' ? 'cap' : 'sign-in-again'
}

/**
 * Step one: the options for the browser to make a passkey with. The session must be a recent
 * sign-in, and the account under the cap; then the per-connection and site-wide limits; then the
 * library's options are made, their challenge stored for this account and tied to this browser
 * by a signed cookie. `ip` is the connection's address, for the limit only.
 */
export function startAddPasskey(ip: string | null): Promise<StartAddPasskeyResult> {
  return runUseCase<StartAddPasskeyResult>('Passkey options', () => start(ip), FAILED)
}

async function start(ip: string | null): Promise<StartAddPasskeyResult> {
  const relyingParty = getPasskeyRelyingParty()
  if (!relyingParty) return FAILED
  const session = await getSignInSession()
  const now = new Date()
  const refused = await refusal(session, now)
  if (refused || !session) return { ok: false, failure: refused ?? 'sign-in-again' }
  const blocked = await optionsGuard({ token: null, ip }, NO_ROBOT_CHECK)
  if (blocked) return { ok: false, failure: 'too-many' }

  const { options, challenge } = await makeRegistrationOptions({
    relyingParty,
    userName: DEFAULT_PASSKEY_LABEL,
    userHandle: await getOrCreateUserHandle(session.accountId),
    existing: (await listPasskeys(session.accountId)).map(({ credentialId, transports }) => ({
      credentialId,
      transports,
    })),
  })
  const challengeId = await createChallenge({
    purpose: 'add',
    challenge,
    accountId: session.accountId,
    now,
  })
  await saveChallengeCookie(challengeId, now)
  return { ok: true, options }
}

/**
 * Step two: checks the browser's answer and saves the passkey on the session's account. The
 * challenge is taken once from this browser's cookie before anything else, so any failed answer
 * uses it up. The challenge must belong to the session's account, and the session must still be
 * a recent sign-in now, so the challenge's lifetime can't stretch the window. The cap is counted
 * again right before saving, since two adds at the same moment can both pass the first count.
 * A good add sends the account's address a note, after the passkey is stored.
 */
export function finishAddPasskey({
  answer,
  label,
}: AddPasskeyInput): Promise<ActionResult<AddPasskeyFailure>> {
  return runUseCase<ActionResult<AddPasskeyFailure>>(
    'Passkey add',
    () => finish({ answer, label }),
    FAILED,
  )
}

async function finish({
  answer,
  label,
}: AddPasskeyInput): Promise<ActionResult<AddPasskeyFailure>> {
  const relyingParty = getPasskeyRelyingParty()
  if (!relyingParty) return FAILED
  const now = new Date()
  const challengeId = await takeChallengeCookie(now)
  const session = await getSignInSession()
  const early = await refusal(session, now)
  if (early || !session) return { ok: false, failure: early ?? 'sign-in-again' }
  if (challengeId === null) return FAILED

  const challenge = await takeChallenge({ id: challengeId, purpose: 'add', now })
  if (!challenge || challenge.accountId !== session.accountId) return FAILED

  const verified = await verifyNewPasskey({
    answer,
    challenge: challenge.challenge,
    relyingParty,
  })
  if (!verified) return FAILED

  const addedAt = new Date()
  const late = await refusal(session, addedAt)
  if (late) return { ok: false, failure: late }
  const chosen = toPasskeyLabel(label)
  const saved = await savePasskey({ accountId: session.accountId, ...verified, label: chosen })
  if (!saved.saved) return FAILED

  after(() =>
    runUseCase(
      'Passkey added note',
      () => sendEmailToAccount(session.email, toPasskeyAddedEmail({ label: chosen, at: addedAt })),
      undefined,
    ),
  )
  return { ok: true }
}
