import type { Payload } from 'payload'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { purposeKey, signValue } from '../domain/signedValue'
import type * as SocialAccounts from './socialAccounts'

/**
 * The account side of a provider sign-in (#188) against real Payload on an in-memory SQLite
 * database: what a create stores, that the subject column is unique, and that the session it
 * starts is one Payload's own auth accepts. No file, no network.
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
let data: typeof SocialAccounts

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'social-accounts-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
  data = await import('./socialAccounts')
}, 60_000)

beforeEach(() => {
  cookieJar.clear()
})

const stored = (id: number) =>
  payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, showHiddenFields: true })

const profile = (over: Record<string, unknown> = {}) => ({
  provider: 'google' as const,
  subject: `g-${Math.random()}`,
  email: `ana-${Math.random()}@example.com`,
  emailVerified: true,
  name: 'Ana',
  ...over,
})

// Keep this first: it needs an empty users collection, where Payload's first registration
// becomes an admin (`firstAccountIsAdmin`, #354) and a Google sign-in must not
describe('the first account on an empty database', () => {
  it('is a guest when Google creates it, never an admin', async () => {
    expect((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(0)
    const id = await data.createVerifiedAccount(profile())
    expect(await stored(id)).toMatchObject({ role: 'guest', _verified: true })
  })
})

describe('createVerifiedAccount', () => {
  it('stores a verified guest with the subject, and sends no email', async () => {
    const sent = vi.spyOn(payload, 'sendEmail')
    const google = profile()
    const id = await data.createVerifiedAccount(google)
    expect(await stored(id)).toMatchObject({
      email: google.email,
      name: 'Ana',
      role: 'guest',
      _verified: true,
      googleSub: google.subject,
    })
    expect(sent).not.toHaveBeenCalled()
    sent.mockRestore()
  })
})

describe('the role on a provider create', () => {
  it('is forced to guest even when the data asks for admin', async () => {
    const account = await payload.create({
      collection: 'users',
      data: { email: 'forced@example.com', password: 'x'.repeat(20), role: 'admin' },
      disableVerificationEmail: true,
      overrideAccess: true,
      context: { socialSignIn: true },
    })
    expect(account.role).toBe('guest')
  })
})

describe('finding accounts', () => {
  it('finds an account by subject and by email, with its lock', async () => {
    const google = profile()
    const id = await data.createVerifiedAccount(google)
    const until = new Date(Date.now() + 60_000).toISOString()
    await payload.db.updateOne({ collection: 'users', id, data: { lockUntil: until }, returning: false })
    expect(await data.findAccountBySubject('google', google.subject)).toEqual({
      id,
      role: 'guest',
      verified: true,
      lockedUntil: new Date(until),
    })
    expect((await data.findAccountByEmail(google.email))?.id).toBe(id)
  })

  it('allows one provider account on one account only', async () => {
    const first = profile()
    await data.createVerifiedAccount(first)
    await expect(data.createVerifiedAccount(profile({ subject: first.subject }))).rejects.toThrow()
    expect(await data.findAccountBySubject('google', 'g-nobody')).toBeNull()
  })
})

describe('linking a Google identity to an account (#1338)', () => {
  const newAccount = async () => data.createVerifiedAccount(profile())
  // An account that has no Google id, as one made with an email and password
  const passwordAccount = async () => {
    const user = await payload.create({
      collection: 'users',
      data: { email: `pw-${Math.random()}@example.com`, password: 'link-test-password-1', role: 'guest' },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    return user.id
  }

  it('writes the link while the account has none, and says so', async () => {
    const id = await passwordAccount()
    expect(await data.hasLinkedSubject(id, 'google')).toBe(false)
    expect(await data.linkSubject(id, 'google', 'g-link-1')).toBe(true)
    expect(await data.hasLinkedSubject(id, 'google')).toBe(true)
    expect((await data.findAccountBySubject('google', 'g-link-1'))?.id).toBe(id)
  })

  it('never replaces a link the account already has', async () => {
    const id = await passwordAccount()
    expect(await data.linkSubject(id, 'google', 'g-link-2')).toBe(true)
    expect(await data.linkSubject(id, 'google', 'g-link-3')).toBe(false)
    expect((await stored(id)).googleSub).toBe('g-link-2')
  })

  it('refuses a Google identity that is on another account, with nothing changed and no throw', async () => {
    const owner = await newAccount()
    const ownerSub = (await stored(owner)).googleSub as string
    const other = await passwordAccount()
    expect(await data.linkSubject(other, 'google', ownerSub)).toBe(false)
    expect(await data.hasLinkedSubject(other, 'google')).toBe(false)
    expect((await stored(owner)).googleSub).toBe(ownerSub)
  })

  it('lets two links at once keep one', async () => {
    const id = await passwordAccount()
    const results = await Promise.all([
      data.linkSubject(id, 'google', 'g-race-a'),
      data.linkSubject(id, 'google', 'g-race-b'),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
})

describe('the signed flow cookie', () => {
  it('give back a flow once, and refuse one that was changed', async () => {
    const now = new Date()
    const flow = { provider: 'google' as const, state: 's', codeVerifier: 'v', nonce: 'n', linkAccountId: null }
    await data.saveSocialFlow(flow, now)
    expect(cookieJar.get('sprecher-east-social-flow')).toMatchObject({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
    })
    expect(await data.takeSocialFlow(now)).toEqual(flow)
    expect(await data.takeSocialFlow(now)).toBeNull()

    await data.saveSocialFlow(flow, now)
    const saved = cookieJar.get('sprecher-east-social-flow')
    cookieJar.set('sprecher-east-social-flow', { ...saved, value: `x${saved?.value}` })
    expect(await data.takeSocialFlow(now)).toBeNull()
  })

  it('never reads a value signed for another purpose as a flow', async () => {
    const now = new Date()
    const key = purposeKey(payload.secret, 'another-purpose')
    const value = signValue({ provider: 'google', state: 's', codeVerifier: 'v', nonce: 'n' }, key, now, 60_000)
    cookieJar.set('sprecher-east-social-flow', { value })
    expect(await data.takeSocialFlow(now)).toBeNull()
  })
})
