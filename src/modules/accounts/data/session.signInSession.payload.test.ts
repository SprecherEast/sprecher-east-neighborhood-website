import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * When a person signed in (#1314, decision 0021) against real Payload on in-memory SQLite: the
 * session a token names carries its own start time, a refresh doesn't move it, and a token whose
 * session is gone, or no token, gives no session. Only Next's request APIs are replaced.
 */

vi.mock('server-only', () => ({}))
const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}))
vi.mock('@payloadcms/next/auth', () => ({ login: vi.fn() }))

const PASSWORD = 'sign-in-session-test-password'
let payload: Payload
let accountId: number

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'sign-in-session-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
  // The first account on an empty database becomes an admin (#354); the tests use the second
  for (const email of ['first@example.com', 'ada@example.com']) {
    const user = await payload.create({
      collection: 'users',
      data: { email, password: PASSWORD, name: 'Ada', role: 'guest' },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    accountId = user.id
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { _verified: true },
      returning: false,
    })
  }
}, 60_000)

afterAll(() => vi.unstubAllEnvs())

const signInAs = async () => {
  const { token } = await payload.login({
    collection: 'users',
    data: { email: 'ada@example.com', password: PASSWORD },
  })
  request.headers = new Headers({ authorization: `JWT ${token}` })
  return token ?? ''
}

describe('getSignInSession', () => {
  it('gives the account and the start of the session the token names', async () => {
    const before = Date.now()
    await signInAs()
    const { getSignInSession } = await import('./session')
    const session = await getSignInSession()
    expect(session).toMatchObject({ accountId, email: 'ada@example.com' })
    expect(session?.signedInAt?.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(session?.signedInAt?.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('names the token’s own session when the account has several', async () => {
    const first = await signInAs()
    await new Promise((resolve) => setTimeout(resolve, 20))
    await signInAs()
    const { getSignInSession } = await import('./session')
    const second = (await getSignInSession())?.signedInAt?.getTime() ?? 0
    request.headers = new Headers({ authorization: `JWT ${first}` })
    const earlier = (await getSignInSession())?.signedInAt?.getTime() ?? Number.POSITIVE_INFINITY
    expect(earlier).toBeLessThan(second)
  })

  it('isn’t moved by a refresh: staying signed in doesn’t make an old session look new', async () => {
    await signInAs()
    const { getSignInSession } = await import('./session')
    const started = (await getSignInSession())?.signedInAt?.getTime()
    await new Promise((resolve) => setTimeout(resolve, 20))
    const stored = await payload.db.findOne<User>({
      collection: 'users',
      where: { id: { equals: accountId } },
    })
    await payload.db.updateOne({
      collection: 'users',
      id: accountId,
      data: {
        sessions: (stored?.sessions ?? []).map((session) => ({
          ...session,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        })),
      },
      returning: false,
    })
    expect((await getSignInSession())?.signedInAt?.getTime()).toBe(started)
  })

  it('gives nothing when nobody is signed in', async () => {
    request.headers = new Headers()
    const { getSignInSession } = await import('./session')
    expect(await getSignInSession()).toBeNull()
  })

  it('gives nothing once the session is gone, even with the token', async () => {
    await signInAs()
    await payload.db.updateOne({
      collection: 'users',
      id: accountId,
      data: { sessions: [] },
      returning: false,
    })
    const { getSignInSession } = await import('./session')
    expect(await getSignInSession()).toBeNull()
  })
})
