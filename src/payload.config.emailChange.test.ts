import { GRAPHQL_POST, REST_PATCH } from '@payloadcms/next/routes'
import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  bootPayload,
  createAccount,
  type Account,
} from '@/platform/payload/testing/inMemoryPayload'

/**
 * An account's email can't be changed to an unconfirmed address (#555). Payload sends a
 * verification link only when an account is created, so an update to `email` would keep the
 * account marked verified without anyone opening a link to the new address. These tests send the
 * writes a signed-in member could try, through Payload's REST and GraphQL handlers and the Local
 * API, and check what was stored. Payload runs on an in-memory SQLite database.
 */

// The fixed refusal text (src/modules/accounts/domain/emailChange.ts)
const EMAIL_CHANGE_NOT_ALLOWED = 'Your email can’t be changed this way. Ask an admin for help.'

let config: SanitizedConfig
let payload: Payload
let admin: Account

beforeAll(async () => {
  ;({ payload, config } = await bootPayload())
  // The first account on an empty database becomes an admin (#354)
  admin = await createAccount(payload, 'admin', 'admin')
}, 60_000)

const tokenFor = async (account: Account) =>
  (
    await payload.login({
      collection: 'users',
      data: { email: account.email, password: `${account.name}-password-for-tests` },
    })
  ).token ?? ''

const storedEmail = async (id: number) =>
  (await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true })).email

async function restPatch(id: number, token: string, body: Record<string, unknown>) {
  return REST_PATCH(Promise.resolve(config))(
    new Request(`http://localhost:3000/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: ['users', String(id)] }) },
  )
}

describe('changing your own email', () => {
  it.each(['guest', 'resident', 'editor'] as const)(
    'is refused over REST for a %s, and the stored email stays',
    async (role) => {
      const member = await createAccount(payload, role, `${role}-rest`)
      const response = await restPatch(member.id, await tokenFor(member), {
        email: `new-${role}@example.com`,
      })
      expect(response.status).toBe(403)
      expect(await storedEmail(member.id)).toBe(member.email)
    },
  )

  it('is refused in a Local API update made as the member, with the fixed text', async () => {
    const member = await createAccount(payload, 'guest', 'guest-local')
    await expect(
      payload.update({
        collection: 'users',
        id: member.id,
        data: { email: 'changed-local@example.com' },
        user: member,
        overrideAccess: false,
      }),
    ).rejects.toThrow(EMAIL_CHANGE_NOT_ALLOWED)
    expect(await storedEmail(member.id)).toBe(member.email)
  })

  it('is refused over GraphQL, with the fixed text', async () => {
    const member = await createAccount(payload, 'guest', 'guest-graphql')
    const response = await GRAPHQL_POST(Promise.resolve(config))(
      new Request('http://localhost:3000/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `JWT ${await tokenFor(member)}`,
        },
        body: JSON.stringify({
          query: `mutation { updateUser(id: ${member.id}, data: { email: "changed-graphql@example.com" }) { id } }`,
        }),
      }),
    )
    const body = (await response.json()) as { errors?: { message: string }[] }
    expect(JSON.stringify(body.errors)).toContain(EMAIL_CHANGE_NOT_ALLOWED)
    expect(await storedEmail(member.id)).toBe(member.email)
  })

  it('still lets a member change other details such as the name', async () => {
    const member = await createAccount(payload, 'guest', 'guest-name')
    const response = await restPatch(member.id, await tokenFor(member), {
      name: 'Renamed',
      email: member.email,
    })
    expect(response.status).toBe(200)
  })

  it('still lets a signed-in admin change another account’s email', async () => {
    const member = await createAccount(payload, 'guest', 'guest-admin-edit')
    const response = await restPatch(member.id, await tokenFor(admin), {
      email: 'by-admin@example.com',
    })
    expect(response.status).toBe(200)
    expect(await storedEmail(member.id)).toBe('by-admin@example.com')
  })
})
