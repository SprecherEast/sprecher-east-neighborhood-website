import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bootPayload,
  createAccount,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'

import { REMEMBER_ME_LIFETIME_MS } from '../domain/sessionLifetimes'
import type * as Session from './session'

/**
 * Starting a session for an account whose person was checked another way than by password
 * (Google, #188; a passkey, #1315) against real Payload on an in-memory SQLite database: the
 * cookie it sets is one Payload's own auth accepts, and "Keep me signed in" lasts a week. The
 * first tests are the ones PR #505 wrote for this code before it moved here.
 */

vi.mock('server-only', () => ({}))
const cookieJar = vi.hoisted(() => new Map<string, { value: string } & Record<string, unknown>>())
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options: Record<string, unknown> = {}) =>
      options.maxAge === 0 ? cookieJar.delete(name) : cookieJar.set(name, { ...options, value }),
    delete: (name: string) => cookieJar.delete(name),
  }),
}))
vi.mock('@payloadcms/next/auth', () => ({ login: vi.fn() }))

let payload: Payload
let session: typeof Session
let ada: Account

beforeAll(async () => {
  payload = (await bootPayload()).payload
  session = await import('./session')
  ada = await createAccount(payload, 'guest', 'ada')
}, 60_000)
afterAll(() => vi.unstubAllEnvs())
beforeEach(() => cookieJar.clear())

/** What Payload's auth says about the cookie this browser now holds, sent as a browser sends it. */
const whoHolds = async () => {
  const { user } = await payload.auth({
    headers: new Headers({
      cookie: `payload-token=${cookieJar.get('payload-token')?.value}`,
      'sec-fetch-site': 'same-origin',
    }),
  })
  return user
}

const claim = (token: string, name: 'exp' | 'sid') =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))[name]

describe('startSessionFor', () => {
  it('sets Payload’s own auth cookie, which Payload’s auth accepts as that account', async () => {
    await session.startSessionFor(ada.id)
    expect(cookieJar.get('payload-token')).toMatchObject({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    })
    expect(await whoHolds()).toMatchObject({ id: ada.id, collection: 'users' })
  })

  it('records a session on the account that the token names, so signing out ends it', async () => {
    await session.startSessionFor(ada.id)
    const token = cookieJar.get('payload-token')?.value ?? ''
    const stored = await payload.findByID({
      collection: 'users',
      id: ada.id,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    })
    expect(stored.sessions?.some(({ id }) => id === claim(token, 'sid'))).toBe(true)
  })

  it('lasts Payload’s two hours without "Keep me signed in"', async () => {
    const before = Date.now()
    await session.startSessionFor(ada.id)
    const token = cookieJar.get('payload-token')?.value ?? ''
    expect(claim(token, 'exp') * 1000 - before).toBeLessThan(2 * 60 * 60 * 1000 + 5_000)
  })

  it('lasts a week with it: token, stored session and cookie, and Payload still accepts it', async () => {
    const before = Date.now()
    await session.startSessionFor(ada.id, { rememberMe: true })
    const cookie = cookieJar.get('payload-token') as { value: string; expires: Date }
    expect(cookie.expires.getTime() - before).toBeGreaterThan(REMEMBER_ME_LIFETIME_MS - 5_000)
    expect(claim(cookie.value, 'exp') * 1000 - before).toBeGreaterThan(
      REMEMBER_ME_LIFETIME_MS - 5_000,
    )
    expect(await whoHolds()).toMatchObject({ id: ada.id })
  })

  it('throws, setting no cookie, for an account that is gone', async () => {
    await expect(session.startSessionFor(9_999_999)).rejects.toThrow('gone')
    expect(cookieJar.has('payload-token')).toBe(false)
  })
})
