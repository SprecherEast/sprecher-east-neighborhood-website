import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { bootPayload, createAccount } from '@/platform/payload/testing/inMemoryPayload'

/**
 * The note on an admin's delete against real Payload on an in-memory SQLite database (#1316): the
 * Local API delete sends it, and deleting the whole account sends none.
 */

let payload: Payload
const sent = vi.fn()

beforeAll(async () => {
  payload = (await bootPayload()).payload
  payload.sendEmail = sent as unknown as Payload['sendEmail']
}, 60_000)

let credential = 0
const passkeyFor = (account: number, label: string) =>
  payload.db.create({
    collection: 'passkeys',
    data: {
      account,
      credentialId: `cred-${(credential += 1)}`,
      publicKey: 'pk',
      deviceType: 'multiDevice',
      label,
    },
  })

describe('deleting a passkey in the admin', () => {
  it('sends its account a note with the label, and the passkey is gone', async () => {
    sent.mockClear()
    const account = await createAccount(payload, 'guest', 'noted')
    const row = await passkeyFor(account.id, 'Kitchen tablet')
    await payload.delete({ collection: 'passkeys', id: row.id, overrideAccess: true })
    expect(sent).toHaveBeenCalledOnce()
    expect(sent.mock.calls[0]?.[0]).toMatchObject({ to: account.email })
    expect(sent.mock.calls[0]?.[0].text).toContain('“Kitchen tablet”')
    const { totalDocs } = await payload.count({
      collection: 'passkeys',
      where: { id: { equals: row.id } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)
  })

  it('sends nothing when the whole account is deleted', async () => {
    sent.mockClear()
    const account = await createAccount(payload, 'guest', 'leaving')
    await passkeyFor(account.id, 'Phone')
    await payload.delete({ collection: 'users', id: account.id, overrideAccess: true })
    expect(sent).not.toHaveBeenCalled()
  })
})
