import { generatePayloadCookie, type SanitizedCollectionConfig } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isAdmin,
  isAdminFieldAccess,
  isAdminOrEditorBoolean,
  isAdminOrSelf,
} from '@/platform/payload/roles'

import { firstAccountIsAdmin } from './firstAccountIsAdmin'
import { forgotPasswordFromSiteOnly } from './forgotPasswordFromSiteOnly'
import { noResetEmailWhileUnverified } from './noResetEmailWhileUnverified'
import { noPasswordSignInForAgents } from './noPasswordSignInForAgents'
import { requireConfirmedEmailChange } from './requireConfirmedEmailChange'
import { requireCurrentPassword } from './requireCurrentPassword'
import { RESET_LINK_LIFETIME_MS } from '../domain/linkLifetimes'
import { Users } from './users'

describe('Users', () => {
  it('uses the shared role checks for every operation', () => {
    expect(Users.access).toEqual({
      admin: isAdminOrEditorBoolean,
      create: isAdmin,
      delete: isAdmin,
      read: isAdminOrSelf,
      unlock: isAdmin,
      update: isAdminOrSelf,
    })
  })

  it('keeps Payload’s auth defaults but the cookie’s Secure flag, the emails and verification', () => {
    // Tests don't run in production, so the flag is off here; the tests below cover both
    expect(Users.auth).toEqual({
      cookies: { secure: false },
      forgotPassword: {
        expiration: RESET_LINK_LIFETIME_MS,
        generateEmailHTML: expect.any(Function),
        generateEmailSubject: expect.any(Function),
      },
      verify: {
        generateEmailHTML: expect.any(Function),
        generateEmailSubject: expect.any(Function),
      },
    })
  })

  it('sends a branded verification email whose link opens the site’s verify page (#187)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://sprechereast.com')
    const auth = typeof Users.auth === 'object' ? Users.auth.verify : undefined
    const email = typeof auth === 'object' ? auth : undefined
    // Payload passes the request and the new user too; the email reads only the token
    const args = { token: 'abc123' } as Parameters<
      NonNullable<NonNullable<typeof email>['generateEmailHTML']>
    >[0]
    const html = await email?.generateEmailHTML?.(args)
    expect(html).toContain('href="https://sprechereast.com/verify-account?token=abc123"')
    expect(html).not.toContain('/admin')
    expect(await email?.generateEmailSubject?.(args)).toBe(
      'Confirm your email to finish your Sprecher East account',
    )
  })

  it('sends a branded reset email whose link opens the site’s reset page, not the admin', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://sprechereast.com')
    const forgot = typeof Users.auth === 'object' ? Users.auth.forgotPassword : undefined
    const html = await forgot?.generateEmailHTML?.({ token: 'abc123' })
    expect(html).toContain('href="https://sprechereast.com/reset-password?token=abc123"')
    expect(html).not.toContain('/admin')
    expect(await forgot?.generateEmailSubject?.({ token: 'abc123' })).toBe(
      'Reset your Sprecher East password',
    )
  })

  it('lets a reset link work for the lifetime the forgot-password page tells people', () => {
    const forgot = typeof Users.auth === 'object' ? Users.auth.forgotPassword : undefined
    expect(forgot?.expiration).toBe(RESET_LINK_LIFETIME_MS)
  })

  it('asks for the current password before anyone changes their own (#233), takes forgot password from the site only (#282), and sends no reset email to an unverified account (#187)', () => {
    expect(Users.hooks).toEqual({
      beforeChange: [firstAccountIsAdmin, requireCurrentPassword, requireConfirmedEmailChange],
      beforeLogin: [noPasswordSignInForAgents],
      beforeOperation: [forgotPasswordFromSiteOnly, noResetEmailWhileUnverified],
    })
  })

  it('makes new accounts guests, and only admins may set a role', () => {
    const role = Users.fields.find((field) => 'name' in field && field.name === 'role')
    expect(role).toMatchObject({
      type: 'select',
      required: true,
      defaultValue: 'guest',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Guest', value: 'guest' },
        { label: 'Resident', value: 'resident' },
        { label: 'Agent', value: 'agent' },
      ],
      access: { create: isAdminFieldAccess, update: isAdminFieldAccess },
    })
  })
})

/**
 * The sign-in cookie as Payload builds it from the real, sanitized config (#234): the same
 * `generatePayloadCookie` that `POST /api/users/login` and the sign-in action use.
 */
async function signInCookie(nodeEnv: string) {
  vi.stubEnv('NODE_ENV', nodeEnv)
  vi.resetModules()
  const config = await (await import('@payload-config')).default
  const users = config.collections.find(
    (collection: SanitizedCollectionConfig) => collection.slug === 'users',
  )
  if (!users?.auth) throw new Error('No users collection with auth')
  return generatePayloadCookie({
    collectionAuthConfig: users.auth,
    cookiePrefix: config.cookiePrefix,
    returnCookieAsObject: true,
    token: 'jwt',
  })
}

// Each test re-imports the whole Payload config, plugins included, which can take seconds
describe('the sign-in cookie', { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is Secure, HttpOnly and Lax in production, so browsers send it over HTTPS only', async () => {
    expect(await signInCookie('production')).toMatchObject({
      name: 'payload-token',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    })
  })

  it('has no Secure flag in development, so signing in over http://localhost works', async () => {
    const cookie = await signInCookie('development')
    expect(cookie.secure).toBeUndefined()
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
  })

  it('has no Secure flag in tests either: only a production build turns it on', async () => {
    expect((await signInCookie('test')).secure).toBeUndefined()
  })
})
