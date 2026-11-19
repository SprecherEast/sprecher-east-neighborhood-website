import { REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { User } from '@/payload-types'

/**
 * Roles on the users collection (#520, #354), against the real config on in-memory SQLite: the
 * first account on an empty database is an admin, every later one is a guest, and nobody but an
 * admin chooses a role.
 */

let config: SanitizedConfig
let payload: Payload

beforeAll(async () => {
  vi.stubEnv('DATABASE_URI', 'file::memory:')
  vi.stubEnv('PAYLOAD_SECRET', 'roles-test-secret-0123456789')
  vi.stubEnv('SMTP_HOST', '')
  const { getPayload } = await import('payload')
  config = await (await import('@payload-config')).default
  payload = await getPayload({ config })
}, 60_000)

const PASSWORD = 'a-long-password-for-tests'

/** Sends a JSON request to Payload's REST API, as the site's `/api` route does. */
async function rest(
  method: 'POST' | 'PATCH',
  path: string[],
  body: Record<string, unknown>,
  token?: string,
): Promise<Response> {
  const handler = (method === 'POST' ? REST_POST : REST_PATCH)(Promise.resolve(config))
  const request = new Request(`http://localhost:3000/api/${path.join('/')}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return handler(request, { params: Promise.resolve({ slug: path }) })
}

const roleOf = async (email: string) =>
  (
    await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      depth: 0,
      overrideAccess: true,
      limit: 1,
    })
  ).docs[0]?.role

describe('roles of new accounts', () => {
  let guest: { id: number; token: string }

  it('makes the first account on an empty database an admin, as /admin first registration creates it', async () => {
    // Nobody is signed in and the form sends no role
    const response = await rest('POST', ['users', 'first-register'], {
      email: 'first@example.com',
      password: PASSWORD,
      'confirm-password': PASSWORD,
      name: 'First',
    })
    expect(response.status).toBe(200)
    expect(await roleOf('first@example.com')).toBe('admin')
  })

  it('makes the second account a guest, as the sign-up action creates it', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: 'second@example.com', password: PASSWORD, name: 'Second', role: 'guest' },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    expect(created.role).toBe('guest')
  })

  it('stores the default role, guest, when none is given', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: 'third@example.com', password: PASSWORD } as User,
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    expect(created.role).toBe('guest')
  })

  it('refuses a visitor’s REST create, with or without a role', async () => {
    const response = await rest('POST', ['users'], {
      email: 'sneaky@example.com',
      password: PASSWORD,
      role: 'admin',
    })
    expect(response.status).toBe(403)
    expect(await roleOf('sneaky@example.com')).toBeUndefined()
  })

  it('does not let a guest change its own role, over the Local API or REST', async () => {
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: 'second@example.com' } },
      overrideAccess: true,
      limit: 1,
    })
    const user = found.docs[0]
    if (!user) throw new Error('the second account is missing')
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { _verified: true },
      returning: false,
    })
    const { token } = await payload.login({
      collection: 'users',
      data: { email: 'second@example.com', password: PASSWORD },
    })
    guest = { id: user.id, token: token ?? '' }

    await payload.update({
      collection: 'users',
      id: guest.id,
      data: { role: 'admin' },
      user: { ...user, collection: 'users' },
      overrideAccess: false,
    })
    const response = await rest(
      'PATCH',
      ['users', String(guest.id)],
      { role: 'resident' },
      guest.token,
    )
    expect(response.status).toBe(200)
    const after = await payload.findByID({
      collection: 'users',
      id: guest.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.role).toBe('guest')
  })

  it('lets an admin set a role', async () => {
    const admin = (
      await payload.find({
        collection: 'users',
        where: { email: { equals: 'first@example.com' } },
        overrideAccess: true,
        limit: 1,
      })
    ).docs[0]
    if (!admin) throw new Error('the first account is missing')
    const updated = await payload.update({
      collection: 'users',
      id: guest.id,
      data: { role: 'resident' },
      user: { ...admin, collection: 'users' },
      overrideAccess: false,
    })
    expect(updated.role).toBe('resident')
  })
})
