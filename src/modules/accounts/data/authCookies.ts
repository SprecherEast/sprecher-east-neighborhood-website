import 'server-only'

import configPromise from '@payload-config'
import { cookies } from 'next/headers'
import { generatePayloadCookie, getPayload } from 'payload'

import { hostCookieName } from '../domain/socialCookies'
import { USERS } from '../domain/usersCollection'

// The cookies the accounts module sets by hand, with their flags in one place: they come from the
// users collection's `auth.cookies` (`cms/users.ts`), so a change there reaches every sign-in
// path (password, "Keep me signed in", Google, and the passkeys of decision 0021 later).

async function authConfig() {
  const payload = await getPayload({ config: configPromise })
  return { payload, auth: payload.collections[USERS].config.auth }
}

/**
 * Sets Payload's own auth cookie for `token`, with the name, scope and flags Payload's `login`
 * sets: the domain, `sameSite` and `secure` of `auth.cookies`, and the expiry of
 * `tokenExpiration` (seconds; the collection's own when left out).
 */
export async function setPayloadAuthCookie(token: string, tokenExpiration?: number): Promise<void> {
  const { payload, auth } = await authConfig()
  const cookie = generatePayloadCookie({
    collectionAuthConfig: { ...auth, tokenExpiration: tokenExpiration ?? auth.tokenExpiration },
    cookiePrefix: payload.config.cookiePrefix,
    returnCookieAsObject: true,
    token,
  })
  ;(await cookies()).set(cookie.name, token, {
    domain: auth.cookies.domain,
    expires: cookie.expires ? new Date(cookie.expires) : undefined,
    httpOnly: true,
    path: '/',
    // Next wants the value lower-case, as Payload's own Next.js sign-in helper passes it
    sameSite:
      typeof auth.cookies.sameSite === 'string'
        ? (auth.cookies.sameSite.toLowerCase() as 'lax' | 'strict' | 'none')
        : 'lax',
    secure: auth.cookies.secure || false,
  })
}

/**
 * A short-lived cookie that belongs to one browser and one flow, such as a sign-in's checks. Where
 * the auth cookie is Secure (production), it is `__Host-` prefixed too: Secure, `Path=/`, no
 * `Domain`, so a page on a sibling subdomain can't plant its own copy. HttpOnly and SameSite=Lax,
 * because a provider's return is a cross-site top-level GET.
 */
export async function hostCookie(base: string) {
  const { auth } = await authConfig()
  const secure = auth.cookies.secure === true
  const name = hostCookieName(base, secure)
  const options = { httpOnly: true, path: '/', sameSite: 'lax', secure } as const
  return {
    name,
    read: async () => (await cookies()).get(name)?.value,
    set: async (value: string, maxAgeSeconds: number) =>
      (await cookies()).set(name, value, { ...options, maxAge: maxAgeSeconds }),
    // Set to expire, not `delete`: a browser refuses a `__Host-` cookie sent without `Secure`
    clear: async () => (await cookies()).set(name, '', { ...options, maxAge: 0 }),
  }
}
