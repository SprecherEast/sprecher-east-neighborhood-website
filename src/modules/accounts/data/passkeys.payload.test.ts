import type { Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { startPayload } from '@/platform/payload/testing/startPayload'

import type { NewPasskey } from '../domain/passkeys'
import {
  NOW as now,
  makeAccount as account,
  minutesAfter as minutes,
  newPasskey as passkey,
} from '../testing/passkeyStore'
import type * as Challenges from './passkeyChallenges'
import type * as Passkeys from './passkeys'

/**
 * The passkey store (#1313, decision 0021) against real Payload on an in-memory SQLite database:
 * insert-only credentials, the conditional counter, the per-account handle and what an account's
 * delete removes.
 */

vi.mock('server-only', () => ({}))

let payload: Payload
let challenges: typeof Challenges
let passkeys: typeof Passkeys

beforeAll(async () => {
  payload = (await startPayload('passkey-store-test-secret-0123456789')).payload
  challenges = await import('./passkeyChallenges')
  passkeys = await import('./passkeys')
}, 60_000)

const makeAccount = () => account(payload)

const savedId = async (p: NewPasskey) => {
  const result = await passkeys.savePasskey(p)
  if (!result.saved) throw new Error('not saved')
  return result.id
}

describe('saving a passkey only inserts', () => {
  it('stores it and finds it by credential ID, with every part', async () => {
    const accountId = await makeAccount()
    const input = passkey(accountId, { counter: 3, transports: ['usb'], label: 'Key' })
    const id = await savedId(input)

    const found = await passkeys.findPasskeyByCredentialId(input.credentialId)
    expect(found).toMatchObject({ id, ...input, lastUsedAt: null })
    expect(found?.addedAt).toBeInstanceOf(Date)
    expect(await passkeys.findPasskeyByCredentialId('nobody-has-this')).toBeNull()
  })

  it('lists and counts an account’s own passkeys, oldest first, and no one else’s', async () => {
    const mine = await makeAccount()
    const theirs = await makeAccount()
    const first = await savedId(passkey(mine, { label: 'First' }))
    const second = await savedId(passkey(mine, { label: 'Second' }))
    await savedId(passkey(theirs))

    expect((await passkeys.listPasskeys(mine)).map((p) => p.id)).toEqual([first, second])
    expect(await passkeys.countPasskeys(mine)).toBe(2)
    expect(await passkeys.countPasskeys(theirs)).toBe(1)
  })

  it('refuses a credential ID already stored on any account, and leaves its key as it was', async () => {
    const owner = await makeAccount()
    const other = await makeAccount()
    const original = passkey(owner, { publicKey: 'the-real-key', label: 'Original' })
    await savedId(original)

    const attempt = passkey(other, { credentialId: original.credentialId, publicKey: 'planted-key' })
    expect(await passkeys.savePasskey(attempt)).toEqual({ saved: false })
    expect(await passkeys.savePasskey({ ...attempt, accountId: owner })).toEqual({ saved: false })

    const found = await passkeys.findPasskeyByCredentialId(original.credentialId)
    expect(found).toMatchObject({ accountId: owner, publicKey: 'the-real-key', label: 'Original' })
    expect(await passkeys.countPasskeys(other)).toBe(0)
  })

  it('saves one of two adds of the same credential made at once', async () => {
    const [a, b] = [await makeAccount(), await makeAccount()]
    const credentialId = `race-credential-${Date.now()}`
    const results = await Promise.all([
      passkeys.savePasskey(passkey(a, { credentialId })),
      passkeys.savePasskey(passkey(b, { credentialId })),
      passkeys.savePasskey(passkey(a, { credentialId })),
    ])
    expect(results.filter((r) => r.saved)).toHaveLength(1)
  })

  it('does not hide other failures as a duplicate', async () => {
    await expect(passkeys.savePasskey(passkey(9_999_999))).rejects.toThrow()
  })
})

describe('the signature counter is written only when higher', () => {
  const setup = async (counter: number) => {
    const accountId = await makeAccount()
    const input = passkey(accountId, { counter })
    return { accountId, input, id: await savedId(input) }
  }
  const stored = async (credentialId: string) => passkeys.findPasskeyByCredentialId(credentialId)

  it('raises it and records the time', async () => {
    const { id, input } = await setup(2)
    expect(await passkeys.recordPasskeyUse(id, 7, minutes(3))).toEqual({ counterRaised: true })
    expect(await stored(input.credentialId)).toMatchObject({
      counter: 7,
      lastUsedAt: minutes(3),
    })
  })

  it('never lowers it, or repeats it, yet still records the time', async () => {
    const { id, input } = await setup(9)
    expect(await passkeys.recordPasskeyUse(id, 4, minutes(1))).toEqual({ counterRaised: false })
    expect(await passkeys.recordPasskeyUse(id, 9, minutes(2))).toEqual({ counterRaised: false })
    expect(await stored(input.credentialId)).toMatchObject({ counter: 9, lastUsedAt: minutes(2) })
  })

  it('accepts a synced passkey that always reports zero', async () => {
    const { id, input } = await setup(0)
    expect(await passkeys.recordPasskeyUse(id, 0, minutes(1))).toEqual({ counterRaised: false })
    expect(await stored(input.credentialId)).toMatchObject({ counter: 0, lastUsedAt: minutes(1) })
  })

  it('keeps the highest when two sign-ins finish at once, in either order', async () => {
    const { id, input } = await setup(1)
    await Promise.all([
      passkeys.recordPasskeyUse(id, 5, minutes(1)),
      passkeys.recordPasskeyUse(id, 12, minutes(1)),
      passkeys.recordPasskeyUse(id, 8, minutes(1)),
    ])
    expect((await stored(input.credentialId))?.counter).toBe(12)
    await Promise.all([
      passkeys.recordPasskeyUse(id, 12, minutes(2)),
      passkeys.recordPasskeyUse(id, 3, minutes(2)),
    ])
    expect((await stored(input.credentialId))?.counter).toBe(12)
  })

  it('does nothing for a passkey that is gone', async () => {
    expect(await passkeys.recordPasskeyUse(9_999_999, 5, minutes(1))).toEqual({ counterRaised: false })
  })
})

describe('removing a passkey', () => {
  it('removes the account’s own, and reports it', async () => {
    const accountId = await makeAccount()
    const input = passkey(accountId)
    const id = await savedId(input)
    expect(await passkeys.deleteOwnPasskey(accountId, id)).toBe(true)
    expect(await passkeys.findPasskeyByCredentialId(input.credentialId)).toBeNull()
    expect(await passkeys.deleteOwnPasskey(accountId, id)).toBe(false)
  })

  it('refuses another account’s passkey and leaves it in place', async () => {
    const owner = await makeAccount()
    const intruder = await makeAccount()
    const input = passkey(owner)
    const id = await savedId(input)
    expect(await passkeys.deleteOwnPasskey(intruder, id)).toBe(false)
    expect(await passkeys.findPasskeyByCredentialId(input.credentialId)).not.toBeNull()
  })

  it('allows removing the last one', async () => {
    const accountId = await makeAccount()
    const id = await savedId(passkey(accountId))
    expect(await passkeys.deleteOwnPasskey(accountId, id)).toBe(true)
    expect(await passkeys.countPasskeys(accountId)).toBe(0)
  })
})

describe('the user handle', () => {
  const storedHandle = async (id: number) =>
    (
      (await payload.findByID({
        collection: 'users',
        id,
        depth: 0,
        overrideAccess: true,
        showHiddenFields: true,
      })) as { passkeyUserHandle?: string | null }
    ).passkeyUserHandle

  it('is made once per account, random and opaque, and reused', async () => {
    const accountId = await makeAccount()
    expect(await passkeys.findUserHandle(accountId)).toBeNull()
    const handle = await passkeys.getOrCreateUserHandle(accountId)
    expect(handle).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(handle).not.toContain('example.com')
    expect(handle).not.toBe(String(accountId))
    expect(await passkeys.getOrCreateUserHandle(accountId)).toBe(handle)
    expect(await passkeys.findUserHandle(accountId)).toBe(handle)
    expect(await storedHandle(accountId)).toBe(handle)
  })

  it('differs between accounts', async () => {
    const [a, b] = [await makeAccount(), await makeAccount()]
    expect(await passkeys.getOrCreateUserHandle(a)).not.toBe(await passkeys.getOrCreateUserHandle(b))
  })

  it('keeps one value when two adds ask at once', async () => {
    const accountId = await makeAccount()
    const handles = await Promise.all(
      Array.from({ length: 10 }, () => passkeys.getOrCreateUserHandle(accountId)),
    )
    expect(new Set(handles).size).toBe(1)
    expect(await storedHandle(accountId)).toBe(handles[0])
  })

  it('is written only while empty: the update carries the emptiness in its where', async () => {
    const accountId = await makeAccount()
    await passkeys.getOrCreateUserHandle(accountId)
    const spy = vi.spyOn(payload.db, 'updateOne')
    try {
      await passkeys.getOrCreateUserHandle(accountId)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('fails for an account that does not exist', async () => {
    await expect(passkeys.getOrCreateUserHandle(9_999_999)).rejects.toThrow()
  })
})

describe('deleting an account', () => {
  it('deletes its passkeys and open challenges, and no one else’s', async () => {
    const gone = await makeAccount()
    const stays = await makeAccount()
    const goneKey = passkey(gone)
    const staysKey = passkey(stays)
    await savedId(goneKey)
    await savedId(passkey(gone))
    await savedId(staysKey)
    const challenge = await challenges.createChallenge({
      purpose: 'add',
      challenge: 'open',
      accountId: gone,
      now,
    })

    await payload.delete({ collection: 'users', id: gone, overrideAccess: true })

    expect(await passkeys.countPasskeys(gone)).toBe(0)
    expect(await passkeys.findPasskeyByCredentialId(goneKey.credentialId)).toBeNull()
    expect(await challenges.takeChallenge({ id: challenge, purpose: 'add', now })).toBeNull()
    expect(await passkeys.findPasskeyByCredentialId(staysKey.credentialId)).not.toBeNull()
  })
})
