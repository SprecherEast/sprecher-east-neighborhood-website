import { describe, expect, it } from 'vitest'

import { removePasskeySchema, toPasskeyListItem } from './removePasskey'
import type { StoredPasskey } from './passkeys'

describe('removePasskeySchema: the input is only the passkey’s id', () => {
  it('accepts a whole, positive number', () => {
    expect(removePasskeySchema.parse({ passkeyId: 12 })).toEqual({ passkeyId: 12 })
  })

  it('drops anything else the caller adds, such as an account', () => {
    expect(removePasskeySchema.parse({ passkeyId: 12, accountId: 8 })).toEqual({ passkeyId: 12 })
  })

  it.each([
    ['nothing', undefined],
    ['text', 'hello'],
    ['no id', {}],
    ['an id as text', { passkeyId: '12' }],
    ['zero', { passkeyId: 0 }],
    ['a negative id', { passkeyId: -1 }],
    ['a fraction', { passkeyId: 1.5 }],
    ['infinity', { passkeyId: Number.POSITIVE_INFINITY }],
    ['an id past safe integers', { passkeyId: 2 ** 60 }],
    ['an object for an id', { passkeyId: { $ne: 0 } }],
  ])('refuses %s', (_name, input) => {
    expect(removePasskeySchema.safeParse(input).success).toBe(false)
  })
})

describe('toPasskeyListItem: only what the list shows', () => {
  const stored: StoredPasskey = {
    id: 12,
    accountId: 7,
    credentialId: 'secret-credential',
    publicKey: 'secret-key',
    counter: 4,
    transports: ['internal'],
    deviceType: 'multiDevice',
    backedUp: true,
    label: 'My phone',
    addedAt: new Date('2026-11-03T15:00:00.000Z'),
    lastUsedAt: new Date('2026-11-05T15:00:00.000Z'),
  }

  it('keeps the id, the label and the two times as text', () => {
    expect(toPasskeyListItem(stored)).toEqual({
      id: 12,
      label: 'My phone',
      addedAt: '2026-11-03T15:00:00.000Z',
      lastUsedAt: '2026-11-05T15:00:00.000Z',
    })
  })

  it('says null for a passkey that was never used', () => {
    expect(toPasskeyListItem({ ...stored, lastUsedAt: null }).lastUsedAt).toBeNull()
  })
})
