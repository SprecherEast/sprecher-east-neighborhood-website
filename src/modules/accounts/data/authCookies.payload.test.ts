import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as AuthCookies from './authCookies'

/**
 * The accounts module's hand-set cookies against real Payload, with the production setting: their
 * flags come from the users collection's `auth.cookies`, and the flow cookie is `__Host-` prefixed
 * (decision 0020). No file, no network.
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

let payload: Payload
let cookies: typeof AuthCookies

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'auth-cookies-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
  cookies = await import('./authCookies')
}, 60_000)

beforeEach(() => jar.clear())

describe('setPayloadAuthCookie', () => {
  it('takes Secure and SameSite from the users collection, as Payload’s own sign-in does', async () => {
    const { cookies: settings } = payload.collections.users.config.auth
    expect(settings.secure).toBe(true)
    await cookies.setPayloadAuthCookie('token-1')
    expect(jar.get('payload-token')).toMatchObject({
      value: 'token-1',
      httpOnly: true,
      path: '/',
      secure: true,
      sameSite: 'lax',
    })
  })

  it('lasts the length it is given, or the collection’s own', async () => {
    await cookies.setPayloadAuthCookie('t', 7 * 24 * 3600)
    const week = new Date(String(jar.get('payload-token')?.expires)).getTime()
    await cookies.setPayloadAuthCookie('t')
    const own = new Date(String(jar.get('payload-token')?.expires)).getTime()
    expect(week).toBeGreaterThan(own + 24 * 3600 * 1000)
  })
})

describe('hostCookie', () => {
  it('is __Host- prefixed, Secure, Path=/, with no Domain, in production', async () => {
    const cookie = await cookies.hostCookie('sprecher-east-social-flow')
    expect(cookie.name).toBe('__Host-sprecher-east-social-flow')
    await cookie.set('v', 600)
    const saved = jar.get('__Host-sprecher-east-social-flow')
    expect(saved).toMatchObject({
      value: 'v',
      secure: true,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
    })
    expect(saved).not.toHaveProperty('domain')
    expect(await cookie.read()).toBe('v')
  })

  it('is cleared by an expired copy that is still Secure, so a browser accepts it', async () => {
    const cookie = await cookies.hostCookie('sprecher-east-social-flow')
    await cookie.clear()
    expect(jar.get('__Host-sprecher-east-social-flow')).toMatchObject({
      value: '',
      maxAge: 0,
      secure: true,
      path: '/',
    })
  })

  it('is SameSite=Strict when asked, for a cookie only our own pages send back', async () => {
    const cookie = await cookies.hostCookie('sprecher-east-passkey-challenge', 'strict')
    expect(cookie.name).toBe('__Host-sprecher-east-passkey-challenge')
    await cookie.set('v', 300)
    expect(jar.get('__Host-sprecher-east-passkey-challenge')).toMatchObject({
      secure: true,
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 300,
    })
    await cookie.clear()
    expect(jar.get('__Host-sprecher-east-passkey-challenge')).toMatchObject({
      sameSite: 'strict',
      maxAge: 0,
    })
  })
})

describe('signingKeyFor', () => {
  it('gives each purpose its own key, never Payload’s secret itself', async () => {
    const flow = await cookies.signingKeyFor('social-flow')
    const challenge = await cookies.signingKeyFor('passkey-challenge')
    expect(flow.equals(challenge)).toBe(false)
    expect(flow.equals(await cookies.signingKeyFor('social-flow'))).toBe(true)
    expect(flow.equals(Buffer.from(payload.secret))).toBe(false)
  })
})
