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
}

/** A signed flow cookie's data as a flow, or null when it isn't one. */
export function toSocialFlow(data: Record<string, unknown> | null): SocialFlow | null {
  if (!data) return null
  const provider = parseSocialProvider(data.provider)
  const { state, codeVerifier, nonce } = data
  if (!provider || typeof state !== 'string' || typeof codeVerifier !== 'string') return null
  if (typeof nonce !== 'string') return null
  return { provider, state, codeVerifier, nonce }
}

/**
 * The cookie's name where it can be `__Host-` prefixed: browsers accept that prefix only on a
 * Secure cookie with `Path=/` and no `Domain`, so a sibling subdomain can't set one (decision 0020).
 */
export const hostCookieName = (name: string, secure: boolean) => (secure ? `__Host-${name}` : name)
