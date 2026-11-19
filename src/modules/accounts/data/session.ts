import 'server-only'

import configPromise from '@payload-config'
import { login } from '@payloadcms/next/auth'
import { cookies, headers } from 'next/headers'
import {
  createLocalReq,
  generateExpiredPayloadCookie,
  getPayload,
  logoutOperation,
  type Payload,
} from 'payload'
import { cache } from 'react'

import type { User } from '@/payload-types'

import type { PasswordChangeValues, SignInValues } from '../domain/credentials'
import { CURRENT_PASSWORD_CONFIRMED } from '../domain/passwordConfirmation'
import type { CurrentUser } from '../domain/types'
import { USERS } from '../domain/usersCollection'
import { isRefusal } from './failures'
import { toCurrentUser } from './mappers'
import { keepSignedIn } from './rememberedSession'

/** An account from the users collection, as Payload's auth returns it. */
type SessionAccount = User & { collection: typeof USERS }

/**
 * The Payload user this request's auth cookie belongs to, or null (Payload's own check). Only an
 * account counts: an MCP API key sent as a header authenticates as the key itself (#336).
 */
async function getSessionPayloadUser(): Promise<SessionAccount | null> {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== USERS || !('email' in user)) return null
  return { ...user, collection: USERS }
}

/**
 * Who is signed in for this request, or null, checked by Payload's Local API. Cached per request,
 * so a page, its metadata and the checks it makes ask Payload once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await getSessionPayloadUser()
  return user ? toCurrentUser(user) : null
})

/**
 * Signs in with Payload's own Next.js helper (`login` from `@payloadcms/next/auth`): it runs
 * Payload's `login` operation, so a wrong password counts towards the lockout, and sets the auth
 * cookie from the users collection's auth settings (#234: Secure in production), which last two
 * hours. With `rememberMe` ("Keep me signed in") the session then lasts a week instead (#587).
 * Throws Payload's error when it refuses.
 */
export async function startSession({ email, password, rememberMe }: SignInValues): Promise<void> {
  const { token } = await login({ collection: USERS, config: configPromise, email, password })
  if (!rememberMe) return
  // Payload always returns the token here; if it ever stops, fail rather than keep a short sign-in
  // the person asked to be long
  if (!token) throw new Error('Payload returned no sign-in token')
  await keepSignedIn(token)
}

/**
 * Ends this request's session the way `POST /api/users/logout` does: Payload forgets the session,
 * then the auth cookie is deleted. The cookie is deleted even when Payload fails to forget the
 * session, so signing out always signs this browser out.
 *
 * Not Payload's `logout` helper from `@payloadcms/next/auth`: in 3.91 it deletes the first cookie
 * whose name starts with the cookie prefix, which can be the admin's `payload-theme` instead of
 * the auth cookie, leaving the browser signed in. The auth cookie's name, domain and path come
 * from Payload's own expired cookie, so the right one is deleted.
 */
export async function endSession(): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const users = payload.collections[USERS]
  try {
    const user = await getSessionPayloadUser()
    if (user) {
      await logoutOperation({ collection: users, req: await createLocalReq({ user }, payload) })
    }
  } finally {
    const { name, domain, path, secure } = generateExpiredPayloadCookie({
      collectionAuthConfig: users.config.auth,
      cookiePrefix: payload.config.cookiePrefix,
      returnCookieAsObject: true,
    })
    const cookieStore = await cookies()
    cookieStore.delete({ name, domain, path, secure })
  }
}

/** How a password change ended, when it didn't throw. */
export type PasswordChangeOutcome = 'changed' | 'signed-out' | 'wrong-password'

/**
 * Sets a new password on the signed-in account only, once its current password is confirmed
 * (#233): the account comes from the session, and the users collection's access rules still
 * apply (`isAdminOrSelf`). Throws Payload's error when it refuses the new password.
 *
 * Payload keeps only this request's session when a password changes, so the browser stays signed
 * in and every other session ends, including the one the check below records.
 */
export async function setOwnPassword({
  currentPassword,
  newPassword,
}: Pick<PasswordChangeValues, 'currentPassword' | 'newPassword'>): Promise<PasswordChangeOutcome> {
  const user = await getSessionPayloadUser()
  if (!user) return 'signed-out'
  const payload = await getPayload({ config: configPromise })
  if (!(await isOwnPassword(payload, user, currentPassword))) return 'wrong-password'
  await payload.update({
    collection: USERS,
    id: user.id,
    data: { password: newPassword },
    depth: 0,
    overrideAccess: false,
    user,
    // Only now: the users collection refuses your own new password without it
    context: { [CURRENT_PASSWORD_CONFIRMED]: true },
  })
  return 'changed'
}

/**
 * Checks a password against the session's own account with Payload's `login` operation, as
 * `POST /api/users/login` runs it, so a wrong one counts towards the lockout. The email is the
 * session's, never the caller's. Its token is dropped and no cookie is set. The session it
 * records ends when the password changes, or expires if the update then fails (nobody holds its
 * token). Throws when Payload fails rather than refuses.
 */
async function isOwnPassword(
  payload: Payload,
  user: SessionAccount,
  password: string,
): Promise<boolean> {
  try {
    await payload.login({
      collection: USERS,
      data: { email: user.email, password },
      overrideAccess: false,
    })
    return true
  } catch (error) {
    if (isRefusal(error)) return false
    throw error
  }
}
