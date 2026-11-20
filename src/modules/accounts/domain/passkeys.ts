// Passkey rules (#1313, decision 0021): who may add, use or remove one, the cap, the relying
// party, the switch, the challenge's lifetime and the label. Pure: no Payload, no Next.js and no
// WebAuthn library, which never sees an account.

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

/**
 * How recent the session's sign-in must be to add a passkey. The session's own start time counts,
 * so "keep me signed in" doesn't make an old session look new.
 */
export const RECENT_SIGN_IN_WINDOW_MS = 5 * 60 * 1000

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
 * What a label may hold: letters and numbers in any language, spaces, apostrophes, hyphens,
 * underscores, commas and round brackets. No dot, colon, slash, `@` or angle bracket, so a label
 * can never read as a link or an address: it goes into the email that warns about a passkey
 * added with a stolen password (decision 0021), where mail apps turn such text into links.
 */
const ALLOWED_LABEL_CHARACTERS = /^[\p{L}\p{N}\p{M} '’_,()-]*$/u
const DISALLOWED_LABEL_CHARACTER = /[^\p{L}\p{N}\p{M} '’_,()-]/gu

/** Whether a typed label is within the rule, and short enough, as it is. Empty is allowed. */
export const isAllowedPasskeyLabel = (raw: string): boolean =>
  raw.length <= PASSKEY_LABEL_MAX_LENGTH && ALLOWED_LABEL_CHARACTERS.test(raw)

/**
 * The label shown to the resident and put in the email: one line, kept short, only the allowed
 * characters (any other becomes a space, so `help.example` reads as `help example`); the default
 * when none is left.
 */
export function toPasskeyLabel(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_PASSKEY_LABEL
  const label = raw
    .replace(DISALLOWED_LABEL_CHARACTER, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PASSKEY_LABEL_MAX_LENGTH)
    .trim()
  return label || DEFAULT_PASSKEY_LABEL
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
  const age = signedInAt ? now.getTime() - signedInAt.getTime() : Number.NaN
  if (!(age >= 0 && age <= RECENT_SIGN_IN_WINDOW_MS)) return { ok: false, reason: 'sign-in-again' }
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
