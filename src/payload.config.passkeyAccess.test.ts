import type { Payload, SanitizedConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { restRequest } from '@/platform/payload/testing/restRequest'
import { startPayload } from '@/platform/payload/testing/startPayload'

let config: SanitizedConfig
let payload: Payload

beforeAll(async () => {
  ;({ payload } = await startPayload('passkey-access-test-secret-0123456789'))
  config = payload.config
}, 60_000)

type Method = Parameters<typeof restRequest>[1]

/** A request to Payload's REST API; `body` and `token` are optional. */
const rest = (method: Method, path: string[], body?: Record<string, unknown>, token?: string) =>
  restRequest(config, method, path, { body, token })

const stored = (collection: 'passkeys', id: number) =>
  payload.findByID({ collection, id, depth: 0, overrideAccess: true, showHiddenFields: true })

/**
 * Passkeys and their challenges (#1313, decision 0021): only the server writes them. A resident
 * reads, creates, changes or deletes neither; an admin reads and deletes passkeys for support
 * and creates or updates neither, and has no access at all to challenges. Checked over REST and
 * the Local API with access on.
 */
describe('passkeys and passkey challenges', () => {
  const password = 'passkey-access-password'
  let resident: { id: number; token: string }
  let admin: { id: number; token: string }
  let passkeyId: number
  let challengeId: number

  const account = async (email: string, role: 'guest' | 'admin') => {
    const user = await payload.create({
      collection: 'users',
      data: { email, password, name: email, role },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: { _verified: true },
      returning: false,
    })
    const { token } = await payload.login({ collection: 'users', data: { email, password } })
    return { id: user.id, token: token ?? '' }
  }

  const newPasskey = (credentialId: string) => ({
    account: resident.id,
    credentialId,
    publicKey: 'public-key-text',
    counter: 1,
    deviceType: 'multiDevice' as const,
    label: 'Phone',
  })

  const asUser = async (who: { id: number }) => ({
    ...(await payload.findByID({
      collection: 'users',
      id: who.id,
      depth: 0,
      overrideAccess: true,
    })),
    collection: 'users' as const,
  })

  beforeAll(async () => {
    resident = await account('passkey-resident@example.com', 'guest')
    admin = await account('passkey-admin@example.com', 'admin')
    passkeyId = (
      await payload.create({
        collection: 'passkeys',
        data: newPasskey('stored-credential'),
        overrideAccess: true,
      })
    ).id
    challengeId = (
      await payload.create({
        collection: 'passkey-challenges',
        data: {
          purpose: 'add',
          challenge: 'secret-challenge',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        overrideAccess: true,
      })
    ).id
  })

  const attempts = (token: string | undefined) =>
    [
      ['read the list', () => rest('GET', ['passkeys'], undefined, token)],
      ['read one', () => rest('GET', ['passkeys', String(passkeyId)], undefined, token)],
      ['create', () => rest('POST', ['passkeys'], newPasskey('forged-credential'), token)],
      ['update', () => rest('PATCH', ['passkeys', String(passkeyId)], { label: 'Renamed' }, token)],
    ] as const

  it('refuse a visitor and a resident every operation over REST', async () => {
    for (const token of [undefined, resident.token]) {
      for (const [name, send] of attempts(token)) {
        expect((await send()).status, `passkeys: ${name}`).toBe(403)
      }
      const calls = [
        rest('DELETE', ['passkeys', String(passkeyId)], undefined, token),
        rest('GET', ['passkey-challenges'], undefined, token),
        rest('GET', ['passkey-challenges', String(challengeId)], undefined, token),
        rest(
          'POST',
          ['passkey-challenges'],
          { purpose: 'add', challenge: 'x', expiresAt: '2099-01-01T00:00:00.000Z' },
          token,
        ),
        rest('PATCH', ['passkey-challenges', String(challengeId)], { usedAt: null }, token),
        rest('DELETE', ['passkey-challenges', String(challengeId)], undefined, token),
      ]
      for (const response of await Promise.all(calls)) expect(response.status).toBe(403)
    }
  })

  it('refuse a resident every operation through the Local API with access on', async () => {
    const user = await asUser(resident)
    const as = { user, overrideAccess: false }
    await expect(payload.find({ collection: 'passkeys', ...as })).rejects.toThrow()
    await expect(
      payload.findByID({ collection: 'passkeys', id: passkeyId, ...as }),
    ).rejects.toThrow()
    await expect(
      payload.create({ collection: 'passkeys', data: newPasskey('forged-local'), ...as }),
    ).rejects.toThrow()
    await expect(
      payload.update({ collection: 'passkeys', id: passkeyId, data: { label: 'Renamed' }, ...as }),
    ).rejects.toThrow()
    await expect(payload.delete({ collection: 'passkeys', id: passkeyId, ...as })).rejects.toThrow()
    await expect(payload.find({ collection: 'passkey-challenges', ...as })).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'passkey-challenges',
        id: challengeId,
        data: { usedAt: null },
        ...as,
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'passkey-challenges', id: challengeId, ...as }),
    ).rejects.toThrow()
  })

  it('refuse an admin to create or update either collection, over REST and the Local API', async () => {
    expect(
      (await rest('POST', ['passkeys'], newPasskey('forged-by-admin'), admin.token)).status,
    ).toBe(403)
    expect(
      (await rest('PATCH', ['passkeys', String(passkeyId)], { label: 'Renamed' }, admin.token))
        .status,
    ).toBe(403)
    expect(
      (
        await rest(
          'POST',
          ['passkey-challenges'],
          { purpose: 'add', challenge: 'x', expiresAt: '2099-01-01T00:00:00.000Z' },
          admin.token,
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await rest(
          'PATCH',
          ['passkey-challenges', String(challengeId)],
          { usedAt: null },
          admin.token,
        )
      ).status,
    ).toBe(403)

    const user = await asUser(admin)
    const as = { user, overrideAccess: false }
    await expect(
      payload.create({ collection: 'passkeys', data: newPasskey('forged-local-admin'), ...as }),
    ).rejects.toThrow()
    await expect(
      payload.update({ collection: 'passkeys', id: passkeyId, data: { label: 'Renamed' }, ...as }),
    ).rejects.toThrow()

    const row = await stored('passkeys', passkeyId)
    expect(row).toMatchObject({ label: 'Phone', counter: 1 })
  })

  it('give an admin no access to challenges: not to read, delete or see them', async () => {
    expect((await rest('GET', ['passkey-challenges'], undefined, admin.token)).status).toBe(403)
    expect(
      (await rest('GET', ['passkey-challenges', String(challengeId)], undefined, admin.token))
        .status,
    ).toBe(403)
    expect(
      (await rest('DELETE', ['passkey-challenges', String(challengeId)], undefined, admin.token))
        .status,
    ).toBe(403)
    const user = await asUser(admin)
    await expect(
      payload.find({ collection: 'passkey-challenges', user, overrideAccess: false }),
    ).rejects.toThrow()
    // The refused delete above left it in place
    const kept = await payload.findByID({
      collection: 'passkey-challenges',
      id: challengeId,
      depth: 0,
      overrideAccess: true,
    })
    expect(kept.id).toBe(challengeId)
  })

  it('let an admin read passkeys for support without the key material, then delete one', async () => {
    const list = await rest('GET', ['passkeys'], undefined, admin.token)
    expect(list.status).toBe(200)
    const { docs } = (await list.json()) as { docs: Array<Record<string, unknown>> }
    const doc = docs.find((d) => d.id === passkeyId)
    expect(doc).toMatchObject({ label: 'Phone', counter: 1, deviceType: 'multiDevice' })
    expect(doc).not.toHaveProperty('credentialId')
    expect(doc).not.toHaveProperty('publicKey')

    const removed = await rest('DELETE', ['passkeys', String(passkeyId)], undefined, admin.token)
    expect(removed.status).toBe(200)
    expect(
      await payload.count({
        collection: 'passkeys',
        where: { id: { equals: passkeyId } },
        overrideAccess: true,
      }),
    ).toMatchObject({ totalDocs: 0 })
  })
})
