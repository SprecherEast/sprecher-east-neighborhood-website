import 'server-only'

import configPromise from '@payload-config'
import { cookies } from 'next/headers'
import { generatePayloadCookie, getPayload, jwtSign } from 'payload'

import { REMEMBER_ME_LIFETIME_MS } from '../domain/sessionLifetimes'
import { USERS } from '../domain/usersCollection'

/** The claims Payload signed into a sign-in token, without the times it adds when it signs. */
function readClaims(token: string): Record<string, unknown> & { id: number | string; sid: string } {
  const body = token.split('.')[1] ?? ''
  const { iat: _issuedAt, exp: _expires, ...claims } = JSON.parse(
    Buffer.from(body, 'base64url').toString('utf8'),
  ) as Record<string, unknown>
  const { id, sid } = claims
  if ((typeof id !== 'number' && typeof id !== 'string') || typeof sid !== 'string') {
    throw new Error('The sign-in token has no account or session id')
  }
  return { ...claims, id, sid }
}

/**
 * Makes the sign-in Payload just recorded last `REMEMBER_ME_LIFETIME_MS` instead of its two hours
 * (#587). Payload's `auth.tokenExpiration` is one value for every sign-in, so for the ones that
 * tick "Keep me signed in" the three things that carry the length are set here, with Payload's own
 * helpers:
 *
 * - the stored session's `expiresAt`: Payload deletes sessions past it the next time the account
 *   signs in anywhere, which would end this one early;
 * - the token, signed again with the same claims (the same session id, so signing out still
 *   revokes it) and the longer expiry;
 * - the auth cookie, with the same name, scope and flags as Payload's, and the longer expiry.
 *
 * Call it only after Payload accepted the password, with the token that sign-in made. The session
 * is extended first: if a later step throws, the browser still holds the short token and the
 * server holds a session that outlives it, which is harmless.
 */
export async function keepSignedIn(token: string): Promise<void> {
  const { id, sid, ...claims } = readClaims(token)
  const payload = await getPayload({ config: configPromise })
  const auth = payload.collections[USERS].config.auth
  const seconds = REMEMBER_ME_LIFETIME_MS / 1000

  const account = await payload.findByID({
    collection: USERS,
    id,
    depth: 0,
    // Server-only: the account comes from a token Payload signed a moment ago, and its sessions
    // are a hidden field
    overrideAccess: true,
    showHiddenFields: true,
  })
  const expiresAt = new Date(Date.now() + REMEMBER_ME_LIFETIME_MS).toISOString()
  await payload.db.updateOne({
    collection: USERS,
    id,
    data: {
      sessions: (account.sessions ?? []).map((session) =>
        session.id === sid ? { ...session, expiresAt } : session,
      ),
    },
    returning: false,
  })

  const { token: longToken } = await jwtSign({
    fieldsToSign: { ...claims, id, sid },
    secret: payload.secret,
    tokenExpiration: seconds,
  })
  const cookie = generatePayloadCookie({
    collectionAuthConfig: { ...auth, tokenExpiration: seconds },
    cookiePrefix: payload.config.cookiePrefix,
    returnCookieAsObject: true,
    token: longToken,
  })
  ;(await cookies()).set(cookie.name, longToken, {
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
