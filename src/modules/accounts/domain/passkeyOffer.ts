/**
 * How long "Not now" holds back the offer to add a passkey (#1364): a month, so a neighbor who said
 * no isn't asked at every log in, and is asked again once in a while. The answer lives in the
 * browser (it is about this device), never on the account.
 */
export const PASSKEY_OFFER_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

/** What the browser stores for "Not now": the time it ends, in milliseconds, as text. */
export const passkeyOfferSnoozeUntil = (now: number): string =>
  String(now + PASSKEY_OFFER_SNOOZE_MS)

/**
 * Whether a stored "Not now" still holds. A value that is missing, isn't a time, or is further off
 * than the snooze itself (edited by hand, or from a clock that was wrong) doesn't count, so a bad
 * value can never silence the offer for good.
 */
export function isPasskeyOfferSnoozed(stored: string | null, now: number): boolean {
  if (!stored) return false
  const until = Number(stored)
  return Number.isFinite(until) && until > now && until - now <= PASSKEY_OFFER_SNOOZE_MS
}
