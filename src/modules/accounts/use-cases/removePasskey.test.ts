import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RECENT_SIGN_IN_WINDOW_MS } from '../domain/signInSession'
import type { StoredPasskey } from '../domain/passkeys'

// Removing a passkey against fakes of the data layer: the order of the checks, what each refusal
// answers, and that only the session's own passkey is ever deleted.

const data = vi.hoisted(() => ({
  getSignInSession: vi.fn(),
  findPasskeyById: vi.fn(),
  deleteOwnPasskey: vi.fn(),
  listPasskeys: vi.fn(),
  sendEmailToAccount: vi.fn(),
  after: [] as Array<() => unknown>,
}))
vi.mock('next/server', () => ({ after: (run: () => unknown) => data.after.push(run) }))
vi.mock('../data/session', () => ({ getSignInSession: data.getSignInSession }))
vi.mock('../data/passkeys', () => ({
  findPasskeyById: data.findPasskeyById,
  deleteOwnPasskey: data.deleteOwnPasskey,
  listPasskeys: data.listPasskeys,
}))
vi.mock('../data/accountEmail', () => ({ sendEmailToAccount: data.sendEmailToAccount }))

import { getOwnPasskeys, removePasskey } from './removePasskey'

const NOW = new Date('2026-11-20T12:00:00.000Z')
const session = {
  accountId: 7,
  email: 'ada@example.com',
  signedInAt: new Date(NOW.getTime() - 60_000),
}
const stored = (over: Partial<StoredPasskey> = {}): StoredPasskey => ({
  id: 12,
  accountId: 7,
  credentialId: 'cred',
  publicKey: 'pk',
  counter: 0,
  transports: [],
  deviceType: 'multiDevice',
  backedUp: true,
  label: 'My phone',
  addedAt: new Date('2026-11-01T00:00:00.000Z'),
  lastUsedAt: null,
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  for (const fn of Object.values(data)) if (typeof fn === 'function') fn.mockReset()
  data.after.length = 0
  data.getSignInSession.mockResolvedValue(session)
  data.findPasskeyById.mockResolvedValue(stored())
  data.deleteOwnPasskey.mockResolvedValue(true)
  data.listPasskeys.mockResolvedValue([stored()])
})
afterEach(() => {
  vi.useRealTimers()
})

describe('removePasskey', () => {
  it('removes the session’s own passkey, then sends the note after the response', async () => {
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: true })
    expect(data.deleteOwnPasskey).toHaveBeenCalledExactlyOnceWith(7, 12)
    expect(data.sendEmailToAccount).not.toHaveBeenCalled()
    await data.after[0]?.()
    const [to, email] = data.sendEmailToAccount.mock.calls[0] ?? []
    expect(to).toBe('ada@example.com')
    expect(email.text).toContain('“My phone”')
    expect(email.text).toContain('Nov 20, 2026, 6:00 AM CST')
  })

  it('refuses another account’s passkey with the same failure as a missing one, and leaves it', async () => {
    data.findPasskeyById.mockResolvedValue(stored({ accountId: 8 }))
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: false, failure: 'failed' })
    data.findPasskeyById.mockResolvedValue(null)
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: false, failure: 'failed' })
    expect(data.deleteOwnPasskey).not.toHaveBeenCalled()
    expect(data.after).toHaveLength(0)
  })

  it('refuses when nobody is signed in, before reading the passkey', async () => {
    data.getSignInSession.mockResolvedValue(null)
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: false, failure: 'sign-in-again' })
    expect(data.findPasskeyById).not.toHaveBeenCalled()
    expect(data.deleteOwnPasskey).not.toHaveBeenCalled()
  })

  it('asks for a new sign-in when the session is too old, and removes nothing', async () => {
    data.getSignInSession.mockResolvedValue({
      ...session,
      signedInAt: new Date(NOW.getTime() - RECENT_SIGN_IN_WINDOW_MS - 1),
    })
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: false, failure: 'sign-in-again' })
    expect(data.deleteOwnPasskey).not.toHaveBeenCalled()
    expect(data.after).toHaveLength(0)
  })

  it('sends no note when the delete finds nothing, such as a second click at once', async () => {
    data.deleteOwnPasskey.mockResolvedValue(false)
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: false, failure: 'failed' })
    expect(data.after).toHaveLength(0)
  })

  it('answers failed, never a throw, when the data layer breaks, and sends nothing', async () => {
    data.deleteOwnPasskey.mockRejectedValue(new Error('db down'))
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: false, failure: 'failed' })
    expect(data.after).toHaveLength(0)
  })

  it('a failed note never undoes the removal', async () => {
    data.sendEmailToAccount.mockRejectedValue(new Error('smtp down'))
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: true })
    await expect(data.after[0]?.()).resolves.toBeUndefined()
  })

  it('lets the last passkey go: email and password remain', async () => {
    data.listPasskeys.mockResolvedValue([])
    expect(await removePasskey({ passkeyId: 12 })).toEqual({ ok: true })
  })
})

describe('getOwnPasskeys', () => {
  it('lists the account’s passkeys as plain items, without the key material', async () => {
    expect(await getOwnPasskeys(7)).toEqual([
      { id: 12, label: 'My phone', addedAt: '2026-11-01T00:00:00.000Z', lastUsedAt: null },
    ])
    expect(data.listPasskeys).toHaveBeenCalledExactlyOnceWith(7)
  })
})
