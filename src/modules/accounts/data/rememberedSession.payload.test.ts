import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { REMEMBER_ME_LIFETIME_MS } from '../domain/sessionLifetimes'

/**
 * "Keep me signed in" (#587) against Payload itself, on in-memory SQLite: what a sign-in with and
 * without the box leaves in the cookie, the token and the stored session, and that Payload
 * accepts the longer token until the week is over. Only Next's request APIs and the cookie its
 * sign-in helper sets are replaced; the helper's `login` runs Payload's own `login` operation.
 */

const HOUR = 60 * 60 * 1000
const edges = vi.hoisted(() => ({ setCookie: vi.fn() }))

let payload: Payload
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: edges.setCookie, delete: vi.fn() }),
}))
vi.mock('@payloadcms/next/auth', () => ({
  login: async ({ email, password }: { email: string; password: string }) =>
    payload.login({ collection: 'users', data: { email, password } }),
}))

const PASSWORD = 'remember-me-test-password'

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'remember-me-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
  // The first account on an empty database becomes an admin (#354); the tests use the second
  await payload.create({
    collection: 'users',
    data: { email: 'first@example.com', password: PASSWORD, name: 'First', role: 'guest' },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
  const user = await payload.create({
    collection: 'users',
    data: { email: 'ada@example.com', password: PASSWORD, name: 'Ada', role: 'guest' },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
  // Verified, as opening the emailed link would, so the account can sign in
  await payload.db.updateOne({
    collection: 'users',
    id: user.id,
    data: { _verified: true },
    returning: false,
  })
}, 60_000)

afterEach(() => {
  vi.useRealTimers()
  edges.setCookie.mockReset()
})
afterAll(() => vi.unstubAllEnvs())

const signIn = async (rememberMe: boolean) => {
  const { startSession } = await import('./session')
  await startSession({ email: 'ada@example.com', password: PASSWORD, rememberMe })
}

/** Ada's stored sessions: id and when each ends. */
async function sessions() {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: 'ada@example.com' } },
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })
  return (docs[0]?.sessions ?? []).map(({ id, expiresAt }) => ({ id, ends: Date.parse(expiresAt) }))
}

/**
 * Who Payload says this token belongs to: its JWT strategy checks the signature, the expiry and
 * that the session is stored. Sent as a header, because Payload applies its CSRF rules to a
 * cookie and the test has no origin; the token is the same one the cookie holds.
 */
async function whoIs(token: string) {
  const { user } = await payload.auth({ headers: new Headers({ authorization: `JWT ${token}` }) })
  return user
}

const claim = (token: string, name: 'exp' | 'sid') =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))[name]

describe('startSession with "Keep me signed in"', () => {
  it('leaves a sign-in without the box as Payload makes it: no cookie of ours, two hours', async () => {
    const before = Date.now()
    await signIn(false)

    expect(edges.setCookie).not.toHaveBeenCalled()
    const ends = (await sessions()).map((session) => session.ends - before)
    expect(ends.at(-1)).toBeGreaterThan(2 * HOUR - 5_000)
    expect(ends.at(-1)).toBeLessThan(2 * HOUR + 5_000)
  })

  it('sets a week-long cookie, token and session, and Payload accepts the token', async () => {
    const before = Date.now()
    await signIn(true)

    const [name, token, options] = edges.setCookie.mock.calls.at(-1) as [
      string,
      string,
      { expires: Date; httpOnly: boolean; path: string; secure: boolean; sameSite: string },
    ]
    expect(name).toBe('payload-token')
    expect(options).toMatchObject({ httpOnly: true, path: '/', sameSite: 'lax' })
    expect(options.expires.getTime() - before).toBeGreaterThan(REMEMBER_ME_LIFETIME_MS - 5_000)
    expect(options.expires.getTime() - before).toBeLessThan(REMEMBER_ME_LIFETIME_MS + 5_000)

    expect(claim(token, 'exp') * 1000 - before).toBeGreaterThan(REMEMBER_ME_LIFETIME_MS - 5_000)
    const session = (await sessions()).find(({ id }) => id === claim(token, 'sid'))
    expect(session && session.ends - before).toBeGreaterThan(REMEMBER_ME_LIFETIME_MS - 5_000)
    expect(await whoIs(token)).toMatchObject({ email: 'ada@example.com', collection: 'users' })
  })

  it('stays valid when the account signs in again later, which clears the expired sessions', async () => {
    await signIn(true)
    const token = edges.setCookie.mock.calls.at(-1)?.[1] as string

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 3 * HOUR })
    await signIn(false) // a later short sign-in; Payload drops every session past its end first

    expect((await sessions()).some(({ id }) => id === claim(token, 'sid'))).toBe(true)
    expect(await whoIs(token)).not.toBeNull()
  })

  it('signs the person out once the week is over', async () => {
    await signIn(true)
    const token = edges.setCookie.mock.calls.at(-1)?.[1] as string

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + REMEMBER_ME_LIFETIME_MS - HOUR })
    expect(await whoIs(token)).not.toBeNull()

    vi.setSystemTime(Date.now() + 2 * HOUR)
    expect(await whoIs(token)).toBeNull()
  })

  it('does not stretch a sign-in made without the box', async () => {
    await signIn(false)

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 3 * HOUR })
    const { token } = await payload.login({
      collection: 'users',
      data: { email: 'ada@example.com', password: PASSWORD },
    })
    // A sign-in made now ends two hours from now, and the one from three hours ago is gone
    expect(claim(token ?? '', 'exp') * 1000 - Date.now()).toBeLessThan(2 * HOUR + 5_000)
    expect(await sessions()).toHaveLength(
      (await sessions()).filter(({ ends }) => ends > Date.now()).length,
    )
  })
})
