import 'server-only'

import { PASSKEY_CHALLENGE_COOKIE, PASSKEY_CHALLENGE_KEY_PURPOSE, toChallengeId } from '../domain/addPasskey'
import { CHALLENGE_TTL_MS } from '../domain/passkeys'
import { readSignedValue, signValue } from '../domain/signedValue'
import { hostCookie, signingKeyFor } from './authCookies'

// The cookie that ties a passkey challenge to the browser that asked for it (decision 0021). It
// carries only the identifier of the stored challenge row, signed under its own key, so it never
// reads as another cookie or as a Payload token. `__Host-` prefixed where cookies are Secure, and
// SameSite=Strict: only our own page sends it back, so a copied challenge fails in another browser.

/** Keeps the challenge's row identifier in this browser for the challenge's lifetime. */
export async function saveChallengeCookie(challengeId: number, now: Date): Promise<void> {
  const value = signValue(
    { cid: challengeId },
    await signingKeyFor(PASSKEY_CHALLENGE_KEY_PURPOSE),
    now,
    CHALLENGE_TTL_MS,
  )
  await (await hostCookie(PASSKEY_CHALLENGE_COOKIE, 'strict')).set(value, CHALLENGE_TTL_MS / 1000)
}

/**
 * The challenge row this browser was given, or null when it has none, or it was altered or
 * expired. Clears the cookie either way, so one cookie serves one answer.
 */
export async function takeChallengeCookie(now: Date): Promise<number | null> {
  const cookie = await hostCookie(PASSKEY_CHALLENGE_COOKIE, 'strict')
  const value = await cookie.read()
  await cookie.clear()
  return toChallengeId(
    readSignedValue(value, await signingKeyFor(PASSKEY_CHALLENGE_KEY_PURPOSE), now),
  )
}
