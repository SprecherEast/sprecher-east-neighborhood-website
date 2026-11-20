import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * The password check the connect-Google step goes through (#1338): Payload's own `login`, so a
 * wrong password counts towards the lockout (#140) and an unverified account is refused, against
 * real Payload on in-memory SQLite. Only Next's request APIs are replaced.
 */

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}))
vi.mock('@payloadcms/next/auth', () => ({ login: vi.fn() }))

const PASSWORD = 'is-password-for-test-password'
let payload: Payload
let isPasswordFor: (email: string, password: string) => Promise<boolean>

const makeAccount = async (email: string, verified: boolean) => {
  const user = await payload.create({
    collection: 'users',
    data: { email, password: PASSWORD, name: 'Ada', role: 'guest' },
    disableVerificationEmail: true,
    overrideAccess: true,
  })
  await payload.db.updateOne({
    collection: 'users',
    id: user.id,
    data: { _verified: verified },
    returning: false,
  })
}

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'is-password-for-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await (await import('@payload-config')).default })
  // The first account on an empty database becomes an admin (#354); the tests use the others
  await makeAccount('first@example.com', true)
  await makeAccount('ada@example.com', true)
  await makeAccount('unverified@example.com', false)
  await makeAccount('locked@example.com', true)
  ;({ isPasswordFor } = await import('./session'))
}, 60_000)

afterAll(() => vi.unstubAllEnvs())

describe('isPasswordFor', () => {
  it('accepts the right password and refuses a wrong one, without throwing', async () => {
    expect(await isPasswordFor('ada@example.com', PASSWORD)).toBe(true)
    expect(await isPasswordFor('ada@example.com', 'wrong')).toBe(false)
  })

  it('refuses an email no account uses, the same as a wrong password', async () => {
    expect(await isPasswordFor('nobody@example.com', PASSWORD)).toBe(false)
  })

  it('refuses an unverified account even with the right password', async () => {
    expect(await isPasswordFor('unverified@example.com', PASSWORD)).toBe(false)
  })

  it('counts wrong passwords towards the lockout: the right one is refused once locked', async () => {
    for (let i = 0; i < 12; i++) await isPasswordFor('locked@example.com', 'wrong')
    expect(await isPasswordFor('locked@example.com', PASSWORD)).toBe(false)
  })
})
