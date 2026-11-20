import 'server-only'

import { runUseCase } from '@/platform/service'

import { saveChallengeCookie, takeChallengeCookie } from '../data/passkeyChallengeCookie'
import { createChallenge, takeChallenge } from '../data/passkeyChallenges'
import { getPasskeyRelyingParty } from '../data/passkeySettings'
import { findPasskeyByCredentialId, findUserHandle, recordPasskeyUse } from '../data/passkeys'
import { startSessionFor } from '../data/session'
import { findAccountById } from '../data/socialAccounts'
import { makeAuthenticationOptions, verifyPasskeyAnswer } from '../data/webauthn'
import { decideUsePasskey } from '../domain/passkeys'
import { PASSKEY_SIGN_IN_LIMITS } from '../domain/requestLimits'
import type {
  PasskeySignInFailure,
  PasskeySignInValues,
  StartPasskeySignInResult,
} from '../domain/signInWithPasskey'
import type { ActionResult } from '../domain/types'
import { createRequestGuard, NO_ROBOT_CHECK } from './guardPublicRequest'

// Signing in with a passkey from `/login` (#1315, decision 0021): two steps, with no account known
// until the answer is checked. Every reason that isn't "too many" is one `failed`, so no answer
// says whether an account exists or which check refused. The WebAuthn library is reached only
// through `data/webauthn.ts`, and the session is Payload's own, started by `data/session.ts`.

const optionsGuard = createRequestGuard('Passkey sign-in options', PASSKEY_SIGN_IN_LIMITS)

const FAILED = { ok: false, failure: 'failed' } as const

/**
 * Step one: the options for the browser to ask for a passkey with. The per-connection and the
 * site-wide limits come first; then the library's options are made, their challenge stored and
 * tied to this browser by a signed cookie. They name no account. `ip` is the connection's address,
 * for the limit only.
 */
export function startPasskeySignIn(ip: string | null): Promise<StartPasskeySignInResult> {
  return runUseCase<StartPasskeySignInResult>('Passkey sign-in options', () => start(ip), FAILED)
}

async function start(ip: string | null): Promise<StartPasskeySignInResult> {
  const relyingParty = getPasskeyRelyingParty()
  if (!relyingParty) return FAILED
  if (await optionsGuard({ token: null, ip }, NO_ROBOT_CHECK)) {
    return { ok: false, failure: 'too-many' }
  }
  const now = new Date()
  const { options, challenge } = await makeAuthenticationOptions({ relyingParty })
  const challengeId = await createChallenge({
    purpose: 'sign-in',
    challenge,
    accountId: null,
    now,
  })
  await saveChallengeCookie(challengeId, now)
  return { ok: true, options }
}

/**
 * Step two: checks the browser's answer and signs in the passkey's owner. The challenge is taken
 * once from this browser's cookie before anything else, so any failed answer uses it up. The
 * credential is found by its ID; the library checks the signature, challenge, origin, relying
 * party ID, screen lock and counter (a framed answer is refused by the adapter); then the answer's
 * user handle must be the owner's, and the owner may be signed in to (not locked, verified, not an
 * agent). Only then are the counter and last use recorded and the session started, with "Keep me
 * signed in" when asked for. A counter that should have gone up and didn't (two sign-ins at once
 * with the same one) is refused too.
 */
export function finishPasskeySignIn({
  answer,
  rememberMe,
}: PasskeySignInValues): Promise<ActionResult<PasskeySignInFailure>> {
  return runUseCase<ActionResult<PasskeySignInFailure>>(
    'Passkey sign-in',
    () => finish({ answer, rememberMe }),
    FAILED,
  )
}

async function finish({
  answer,
  rememberMe,
}: PasskeySignInValues): Promise<ActionResult<PasskeySignInFailure>> {
  const relyingParty = getPasskeyRelyingParty()
  if (!relyingParty) return FAILED
  const now = new Date()
  // The browser's challenge is used up first, whatever else is wrong, so no copy of it stays usable
  const challengeId = await takeChallengeCookie(now)
  const challenge =
    challengeId === null ? null : await takeChallenge({ id: challengeId, purpose: 'sign-in', now })
  if (!challenge) return FAILED

  const passkey = await findPasskeyByCredentialId(answer.id)
  if (!passkey) return FAILED
  const verified = await verifyPasskeyAnswer({
    answer,
    challenge: challenge.challenge,
    relyingParty,
    credential: {
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
      transports: passkey.transports,
    },
  })
  if (!verified) return FAILED

  const decision = decideUsePasskey({
    passkeyOwnerId: passkey.accountId,
    ownerHandle: await findUserHandle(passkey.accountId),
    answerHandle: answer.response.userHandle ?? null,
    owner: await findAccountById(passkey.accountId),
    now,
  })
  if (!decision.ok) return FAILED

  const { counterRaised } = await recordPasskeyUse(passkey.id, verified.newCounter, now)
  if (!counterRaised && verified.newCounter > 0) return FAILED
  await startSessionFor(decision.accountId, { rememberMe })
  return { ok: true }
}
