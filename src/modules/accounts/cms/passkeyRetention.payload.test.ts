import { createLocalReq, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { startPayload } from '@/platform/payload/testing/startPayload'

import { deleteExpiredChallenges } from './passkeyRetention'

/**
 * The retention task against real Payload on an in-memory SQLite database (#1313): it removes
 * the expired challenges and nothing else.
 */

let payload: Payload

beforeAll(async () => {
  payload = (await startPayload('passkey-retention-test-secret-0123456789')).payload
}, 60_000)

const NOW = Date.parse('2026-11-19T12:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

const challenge = (over: Record<string, unknown>) =>
  payload.create({
    collection: 'passkey-challenges',
    data: { purpose: 'sign-in', challenge: 'c', expiresAt: iso(NOW), ...over },
    overrideAccess: true,
  })

const ids = async () =>
  (
    await payload.find({
      collection: 'passkey-challenges',
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
  ).docs.map((doc) => doc.id)

describe('deleteExpiredChallenges', () => {
  it('removes expired challenges, used or not, and keeps the rest', async () => {
    const expired = await challenge({ expiresAt: iso(NOW - 1) })
    const expiredAndUsed = await challenge({
      expiresAt: iso(NOW - 60_000),
      usedAt: iso(NOW - 120_000),
    })
    const open = await challenge({ expiresAt: iso(NOW + 60_000) })
    const usedButNotExpired = await challenge({
      expiresAt: iso(NOW + 60_000),
      usedAt: iso(NOW - 1),
    })
    // The edge: expiring exactly now is expired for a take (`greater_than`), but waits one run
    const atTheEdge = await challenge({ expiresAt: iso(NOW) })

    const req = await createLocalReq({}, payload)
    expect(await deleteExpiredChallenges(req, NOW)).toBe(2)

    const left = await ids()
    expect(left).not.toContain(expired.id)
    expect(left).not.toContain(expiredAndUsed.id)
    expect(left).toEqual(expect.arrayContaining([open.id, usedButNotExpired.id, atTheEdge.id]))
  })

  it('deletes nothing else: passkeys and accounts stay', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'keeps@example.com',
        password: 'retention-test-password',
        role: 'guest',
      },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    const key = await payload.create({
      collection: 'passkeys',
      data: {
        account: user.id,
        credentialId: 'retention-credential',
        publicKey: 'key',
        deviceType: 'singleDevice',
        label: 'Kept',
        counter: 0,
      },
      overrideAccess: true,
    })
    await challenge({ expiresAt: iso(NOW - 1) })

    const req = await createLocalReq({}, payload)
    await deleteExpiredChallenges(req, NOW)

    expect(
      (await payload.findByID({ collection: 'passkeys', id: key.id, overrideAccess: true })).id,
    ).toBe(key.id)
    expect(
      (await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })).id,
    ).toBe(user.id)
  })

  it('does nothing when nothing expired', async () => {
    const req = await createLocalReq({}, payload)
    const before = await ids()
    expect(await deleteExpiredChallenges(req, NOW - 365 * 24 * 3_600_000)).toBe(0)
    expect(await ids()).toEqual(before)
  })
})
