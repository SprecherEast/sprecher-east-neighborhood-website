// Passkey rules (#1313, decision 0021): who may add, use or remove one, the cap, the relying
// party, the switch, the challenge's lifetime and the label. Pure: no Payload, no Next.js and no
// WebAuthn library, which never sees an account.

import { isRecentSignIn } from './signInSession'
import { canSignInTo, type SocialAccount } from './socialSignIn'

/** The collection that holds the saved passkeys. */
export const PASSKEYS = 'passkeys'

/** The collection that holds the one-time challenges. */
export const PASSKEY_CHALLENGES = 'passkey-challenges'

/** What a challenge is for: adding a passkey (a signed-in account) or signing in with one. */
export const CHALLENGE_PURPOSES = ['add', 'sign-in'] as const

export type ChallengePurpose = (typeof CHALLENGE_PURPOSES)[number]

/** How long a challenge may be answered: a few minutes, as the person's device prompt takes. */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000

/** The most passkeys one account may have. */
export const MAX_PASSKEYS_PER_ACCOUNT = 10

/** The longest label kept, so the account's list has room for it. */
export const PASSKEY_LABEL_MAX_LENGTH = 60

/**
 * The label a passkey gets when none is given. It is also the `userName` the passkey manager
 * shows: options are made before the label is saved, and the account's email never goes there.
 */
export const DEFAULT_PASSKEY_LABEL = 'Sprecher East passkey'

/** How a stored passkey says the device keeps it, as WebAuthn names it. */
export type PasskeyDeviceType = 'singleDevice' | 'multiDevice'

/** A saved passkey, as the rules read it. The public key is base64url text. */
export type StoredPasskey = {
  id: number
  accountId: number
  credentialId: string
  publicKey: string
  counter: number
  transports: string[]
  deviceType: PasskeyDeviceType
  backedUp: boolean
  label: string
  addedAt: Date
  lastUsedAt: Date | null
}

/** What the data layer saves: the id and the times are set there. */
export type NewPasskey = Omit<StoredPasskey, 'id' | 'addedAt' | 'lastUsedAt'>

/** A challenge row taken once: what the answer is checked against. */
export type TakenChallenge = {
  id: number
  purpose: ChallengePurpose
  challenge: string
  accountId: number | null
}

/** The relying party: the site's own host as the ID, and its exact address as the origin. */
export type RelyingParty = { id: string; origin: string }

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/**
 * The relying party ID and expected origin for the configured site address, or null when none is
 * usable, which turns the feature off. Never from a request header: the caller passes the
 * configured address. WebAuthn takes a domain name, not an IP address, so those and bare host
 * names are refused. HTTPS is required, except `localhost` over http in development.
 */
export function toRelyingParty(
  siteAddress: string,
  { production }: { production: boolean },
): RelyingParty | null {
  let url: URL
  try {
    url = new URL(siteAddress)
  } catch {
    return null
  }
  const host = url.hostname
  const isLocalhost = host === 'localhost'
  const secure = url.protocol === 'https:'
  if (!secure && !(url.protocol === 'http:' && isLocalhost && !production)) return null
  if (isLocalhost ? production : !host.includes('.')) return null
  if (host.startsWith('[') || IPV4.test(host)) return null
  return { id: host, origin: url.origin }
}

/** Whether the server setting turns passkeys on: only the text `true`, so unset is off. */
export function isPasskeySwitchOn(env: Record<string, string | undefined>): boolean {
  return env.PASSKEYS_ENABLED?.trim().toLowerCase() === 'true'
}

/** When a challenge made at `now` stops working. */
export const toChallengeExpiry = (now: Date): Date => new Date(now.getTime() + CHALLENGE_TTL_MS)

/**
 * What a label may hold, after Unicode compatibility folding (NFKC, so a fullwidth or boxed
 * character is read as the plain one it imitates): letters, numbers and combining marks in
 * any language, spaces, apostrophes, hyphens, underscores, commas and round brackets. No dot,
 * colon, slash, `@` or angle bracket, so a label can't carry a clickable link or address: it goes
 * into the email that warns about a passkey added with a stolen password (decision 0021), where
 * mail apps turn such text into links. Look-alike letters in another script are still letters.
 * Left out as look-alikes or invisible: the spacing modifier letters (except the okina and the
 * modifier apostrophe), the overlay and joiner marks, variation selectors, enclosing marks, and
 * more than three nonspacing marks in a row.
 */
const LABEL_CHARACTERS = String.raw`\p{L}\p{N}\p{M} '’_,()-`
const LABEL_LOOK_ALIKES = String.raw`\u02B0-\u02BA\u02BD-\u02FF\u0334-\u0338\u034F\uFE00-\uFE0F\p{Me}`
const ONE_LABEL_CHARACTER = `(?![${LABEL_LOOK_ALIKES}])[${LABEL_CHARACTERS}]`
const ALLOWED_LABEL = new RegExp(`^(?:${ONE_LABEL_CHARACTER})*$`, 'u')
const OTHER_LABEL_CHARACTER = new RegExp(`(?!${ONE_LABEL_CHARACTER})[\\s\\S]`, 'gu')
const MARKS_IN_A_ROW = 3
const TOO_MANY_MARKS = new RegExp(String.raw`\p{Mn}{${MARKS_IN_A_ROW + 1}}`, 'u')
const MARKS_BEYOND_THE_LIMIT = new RegExp(String.raw`(\p{Mn}{${MARKS_IN_A_ROW}})\p{Mn}+`, 'gu')

/** Whether a typed label is within the rule, and short enough, as it is. Empty is allowed. */
export function isAllowedPasskeyLabel(raw: string): boolean {
  if (raw.length > PASSKEY_LABEL_MAX_LENGTH) return false
  const folded = raw.normalize('NFKC')
  return (
    folded.length <= PASSKEY_LABEL_MAX_LENGTH &&
    ALLOWED_LABEL.test(folded) &&
    !TOO_MANY_MARKS.test(folded)
  )
}

/** Whole characters while the total stays within the length the list counts (UTF-16 units). */
function cutToLength(label: string): string {
  let kept = ''
  for (const character of label) {
    if (kept.length + character.length > PASSKEY_LABEL_MAX_LENGTH) break
    kept += character
  }
  return kept.trim()
}

/**
 * The label shown to the resident and put in the email: one line, kept short, folded (NFKC), only
 * the allowed characters (any other becomes a space, so `help.example` reads as `help example`);
 * the default when none is left.
 */
export function toPasskeyLabel(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_PASSKEY_LABEL
  const label = raw
    .normalize('NFKC')
    .replace(OTHER_LABEL_CHARACTER, ' ')
    .replace(MARKS_BEYOND_THE_LIMIT, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return cutToLength(label) || DEFAULT_PASSKEY_LABEL
}

/** Why an account may not add a passkey now. */
export type AddPasskeyRefusal = 'signed-out' | 'sign-in-again' | 'cap'

/**
 * Who may add a passkey: the signed-in account only (the caller takes it from the session, never
 * from input), whose session started within `RECENT_SIGN_IN_WINDOW_MS`, and which is under the
 * cap. An unknown, unreadable or future sign-in time counts as not recent.
 */
export function decideAddPasskey({
  accountId,
  existingCount,
  signedInAt,
  now,
}: {
  accountId: number | null
  existingCount: number
  signedInAt: Date | null
  now: Date
}): { ok: true } | { ok: false; reason: AddPasskeyRefusal } {
  if (accountId === null) return { ok: false, reason: 'signed-out' }
  if (!isRecentSignIn(signedInAt, now)) return { ok: false, reason: 'sign-in-again' }
  if (existingCount >= MAX_PASSKEYS_PER_ACCOUNT) return { ok: false, reason: 'cap' }
  return { ok: true }
}

/**
 * Who may remove a passkey: the account that owns it, and no one else. Removing the last one is
 * always allowed, so there is no count here: email and password, and forgot password, remain.
 */
export function decideRemovePasskey({
  accountId,
  passkeyOwnerId,
}: {
  accountId: number | null
  passkeyOwnerId: number | null
}): { ok: boolean } {
  return { ok: accountId !== null && accountId === passkeyOwnerId }
}

/**
 * Who a passkey signs in, once the library has verified the answer: the credential's owner, when
 * the answer's user handle equals the handle stored for that owner, and the account may be signed
 * in to (not locked, verified, not an agent). One answer for every refusal, so no one can tell
 * which check failed.
 */
export function decideUsePasskey({
  passkeyOwnerId,
  ownerHandle,
  answerHandle,
  owner,
  now,
}: {
  passkeyOwnerId: number
  ownerHandle: string | null
  answerHandle: string | null
  owner: SocialAccount | null
  now: Date
}): { ok: true; accountId: number } | { ok: false } {
  if (!ownerHandle || !answerHandle || ownerHandle !== answerHandle) return { ok: false }
  if (!owner || owner.id !== passkeyOwnerId || !canSignInTo(owner, now)) return { ok: false }
  return { ok: true, accountId: owner.id }
}
