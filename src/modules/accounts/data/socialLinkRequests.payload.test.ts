import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { PENDING_LINK_TTL_MS } from '../domain/googleLink'
import { purposeKey, signValue } from '../domain/signedValue'
import { toSocialFlow } from '../domain/socialCookies'
import type * as Links from './socialLinkRequests'

/**
 * What Google said while a neighbor enters their password (#1338, decision 0020), against real
 * Payload on an in-memory SQLite database: the record is taken once, expires, is closed to every
 * API, and its cookie carries only a row id and never reads as the sign-in flow. No file, no
 * network.
 */

vi.mock('server-only', () => ({}))
const cookieJar = vi.hoisted(() => new Map<string, { value: string } & Record<string, unknown>>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options: Record<string, unknown> = {}) =>
      options.maxAge === 0 ? cookieJar.delete(name) : cookieJar.set(name, { ...options, value }),
  }),
}))

let payload: Payload
let links: typeof Links
const SECRET = 'social-link-test-secret-0123456789'

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', SECRET)
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
  links = await import('./socialLinkRequests')
}, 60_000)

beforeEach(() => {
  cookieJar.clear()
})

const google = {
  provider: 'google' as const,
  subject: 'g-pending',
  email: 'ana@example.com',
  emailVerified: true,
  name: 'Ana',
}

describe('the pending record', () => {
  it('holds what Google said, and gives it back once', async () => {
    const now = new Date()
    const id = await links.createPendingLink(google, now)
    expect(await links.isPendingLinkOpen(id, now)).toBe(true)
    expect(await links.takePendingLink(id, now)).toEqual({
      provider: 'google',
      subject: 'g-pending',
      email: 'ana@example.com',
    })
    expect(await links.takePendingLink(id, now)).toBeNull()
    expect(await links.isPendingLinkOpen(id, now)).toBe(false)
  })

  it('lets two takes at the same moment get one', async () => {
    const now = new Date()
    const id = await links.createPendingLink(google, now)
    const taken = await Promise.all([links.takePendingLink(id, now), links.takePendingLink(id, now)])
    expect(taken.filter(Boolean)).toHaveLength(1)
  })

  it('expires after ten minutes', async () => {
    const now = new Date()
    const id = await links.createPendingLink(google, now)
    const late = new Date(now.getTime() + PENDING_LINK_TTL_MS + 1000)
    expect(await links.isPendingLinkOpen(id, late)).toBe(false)
    expect(await links.takePendingLink(id, late)).toBeNull()
  })

  it('answers nothing for an identifier that isn’t a row', async () => {
    expect(await links.takePendingLink(0, new Date())).toBeNull()
    expect(await links.takePendingLink(1.5, new Date())).toBeNull()
    expect(await links.takePendingLink(999_999, new Date())).toBeNull()
  })

  it('is closed to every API call, even an admin’s, and keeps its fields from the page', async () => {
    const id = await links.createPendingLink(google, new Date())
    const admin = { id: 1, collection: 'users', role: 'admin', email: 'admin@example.com' }
    await expect(
      payload.findByID({ collection: 'social-link-requests', id, overrideAccess: false, user: admin as never }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'social-link-requests',
        data: { provider: 'google', subject: 'x', email: 'x@example.com', expiresAt: new Date().toISOString() },
        overrideAccess: false,
        user: admin as never,
      }),
    ).rejects.toThrow()
  })
})

describe('the pending-link cookie', () => {
  it('carries only the row, in the flow’s own cookie, flags and lifetime', async () => {
    const now = new Date()
    await links.savePendingLinkCookie(31, now)
    expect(cookieJar.get('sprecher-east-social-flow')).toMatchObject({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
    })
    const value = cookieJar.get('sprecher-east-social-flow')?.value ?? ''
    expect(Buffer.from(value.split('.')[0], 'base64url').toString()).not.toMatch(/ana|g-pending|@/)
  })

  it('is read without being used up, and taken once', async () => {
    const now = new Date()
    await links.savePendingLinkCookie(31, now)
    expect(await links.readPendingLinkCookie(now)).toBe(31)
    expect(await links.readPendingLinkCookie(now)).toBe(31)
    expect(await links.takePendingLinkCookie(now)).toBe(31)
    expect(await links.takePendingLinkCookie(now)).toBeNull()
  })

  it('refuses an expired or altered cookie', async () => {
    const now = new Date()
    await links.savePendingLinkCookie(31, now)
    expect(await links.takePendingLinkCookie(new Date(now.getTime() + PENDING_LINK_TTL_MS + 1000))).toBeNull()
    await links.savePendingLinkCookie(31, now)
    const saved = cookieJar.get('sprecher-east-social-flow')
    cookieJar.set('sprecher-east-social-flow', { ...saved, value: `x${saved?.value}` })
    expect(await links.takePendingLinkCookie(now)).toBeNull()
  })

  it('never reads a sign-in flow as a pending link, nor the other way round', async () => {
    const now = new Date()
    const flowValue = signValue(
      { provider: 'google', state: 's', codeVerifier: 'v', nonce: 'n', pid: 31 },
      purposeKey(SECRET, 'social-flow'),
      now,
      60_000,
    )
    cookieJar.set('sprecher-east-social-flow', { value: flowValue })
    expect(await links.takePendingLinkCookie(now)).toBeNull()

    await links.savePendingLinkCookie(31, now)
    const value = cookieJar.get('sprecher-east-social-flow')?.value
    expect(value).toBeTruthy()
    const { readSignedValue } = await import('../domain/signedValue')
    expect(readSignedValue(value, purposeKey(SECRET, 'social-flow'), now)).toBeNull()
    expect(toSocialFlow({ pid: 31 })).toBeNull()
  })
})
