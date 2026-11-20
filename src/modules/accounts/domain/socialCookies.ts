// The cookie a sign-in with a provider uses (#188, decision 0020), and what it may hold. It is
// signed (`signedValue.ts`), HttpOnly, SameSite=Lax and Secure in production.

import { parseSocialProvider, type SocialProvider } from './socialSignIn'

/**
 * The flow cookie: what the start of a sign-in made (`state`, a PKCE verifier, a `nonce`), read
 * back by the callback in the same browser and then cleared. `Path=/` and `__Host-` prefixed where cookies are Secure, ten minutes.
 */
export const SOCIAL_FLOW_COOKIE = 'sprecher-east-social-flow'
export const SOCIAL_FLOW_TTL_MS = 10 * 60 * 1000

export type SocialFlow = {
  provider: SocialProvider
  state: string
  codeVerifier: string
  nonce: string
  /**
   * The account a signed-in neighbor started this flow from, to connect Google to it (#1338), or
   * null for a sign-in. Signed with the rest, so the callback can't be pointed at another account.
   */
  linkAccountId: number | null
}

/** A signed flow cookie's data as a flow, or null when it isn't one. */
export function toSocialFlow(data: Record<string, unknown> | null): SocialFlow | null {
  if (!data) return null
  const provider = parseSocialProvider(data.provider)
  const { state, codeVerifier, nonce } = data
  if (!provider || typeof state !== 'string' || typeof codeVerifier !== 'string') return null
  if (typeof nonce !== 'string') return null
  const { linkAccountId } = data
  if (linkAccountId !== undefined && linkAccountId !== null && !isAccountId(linkAccountId)) {
    return null
  }
  return { provider, state, codeVerifier, nonce, linkAccountId: linkAccountId ?? null }
}

const isAccountId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/** The purpose of the key the pending-link cookie is signed with, apart from the flow's. */
export const SOCIAL_LINK_KEY_PURPOSE = 'social-link'

/**
 * The pending-link cookie (#1338): the same cookie as the flow, set again once Google's answer
 * is checked and an account already uses its verified email. It carries only the stored record's
 * row (`pid`), never the Google id or the email, and is signed under `SOCIAL_LINK_KEY_PURPOSE`.
 */
/** The pending record a signed cookie's data names, or null when it isn't one. */
export function toPendingLinkId(data: Record<string, unknown> | null): number | null {
  return data && isAccountId(data.pid) ? data.pid : null
}

/**
 * The cookie's name where it can be `__Host-` prefixed: browsers accept that prefix only on a
 * Secure cookie with `Path=/` and no `Domain`, so a sibling subdomain can't set one (decision 0020).
 */
export const hostCookieName = (name: string, secure: boolean) => (secure ? `__Host-${name}` : name)
