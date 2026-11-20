import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { CHALLENGE_TTL_MS } from '../domain/passkeys'
import { signValue } from '../domain/signedValue'
import type * as AuthCookies from './authCookies'
import type * as ChallengeCookie from './passkeyChallengeCookie'

/**
 * The challenge cookie (decision 0021) against real Payload with the production setting: it is
 * `__Host-` prefixed and SameSite=Strict, carries only a row identifier, is signed under its own
 * key, works once, and is refused when altered, expired or signed for another purpose.
 */

vi.mock('server-only', () => ({}))
const jar = vi.hoisted(() => new Map<string, { value: string } & Record<string, unknown>>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, options: Record<string, unknown> = {}) =>
      jar.set(name, { ...options, value }),
  }),
}))

const NAME = '__Host-sprecher-east-passkey-challenge'
const now = new Date('2026-11-19T12:00:00.000Z')

let cookies: typeof ChallengeCookie
let keys: typeof AuthCookies

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'challenge-cookie-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  cookies = await import('./passkeyChallengeCookie')
  keys = await import('./authCookies')
}, 60_000)

beforeEach(() => jar.clear())

describe('the challenge cookie', () => {
  it('is __Host-, Secure, HttpOnly and SameSite=Strict, for the challenge’s lifetime', async () => {
    await cookies.saveChallengeCookie(12, now)
    const saved = jar.get(NAME)
    expect(saved).toMatchObject({
      secure: true,
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: CHALLENGE_TTL_MS / 1000,
    })
    expect(saved).not.toHaveProperty('domain')
  })

  it('carries only the row’s identifier, nothing else', async () => {
    await cookies.saveChallengeCookie(12, now)
    const [body] = String(jar.get(NAME)?.value).split('.')
    expect(JSON.parse(Buffer.from(body ?? '', 'base64url').toString())).toEqual({
      cid: 12,
      exp: now.getTime() + CHALLENGE_TTL_MS,
    })
  })

  it('gives the row back once, then clears the cookie', async () => {
    await cookies.saveChallengeCookie(12, now)
    expect(await cookies.takeChallengeCookie(now)).toBe(12)
    expect(jar.get(NAME)).toMatchObject({ value: '', maxAge: 0, sameSite: 'strict' })
    expect(await cookies.takeChallengeCookie(now)).toBeNull()
  })

  it('gives nothing when the browser has no cookie', async () => {
    expect(await cookies.takeChallengeCookie(now)).toBeNull()
  })

  it('refuses an altered cookie', async () => {
    await cookies.saveChallengeCookie(12, now)
    const value = String(jar.get(NAME)?.value)
    const [, mac] = value.split('.')
    const forged = Buffer.from(JSON.stringify({ cid: 13, exp: now.getTime() + 1e9 })).toString('base64url')
    jar.set(NAME, { value: `${forged}.${mac}` })
    expect(await cookies.takeChallengeCookie(now)).toBeNull()
  })

  it('refuses an expired cookie', async () => {
    await cookies.saveChallengeCookie(12, now)
    const later = new Date(now.getTime() + CHALLENGE_TTL_MS + 1)
    expect(await cookies.takeChallengeCookie(later)).toBeNull()
  })

  it('refuses a value signed for another purpose, such as the Google flow cookie’s key', async () => {
    const other = signValue({ cid: 12 }, await keys.signingKeyFor('social-flow'), now, 60_000)
    jar.set(NAME, { value: other })
    expect(await cookies.takeChallengeCookie(now)).toBeNull()
  })

  it('refuses a signed value that holds no usable identifier', async () => {
    const key = await keys.signingKeyFor('passkey-challenge')
    jar.set(NAME, { value: signValue({ cid: 'twelve' }, key, now, 60_000) })
    expect(await cookies.takeChallengeCookie(now)).toBeNull()
  })
})
