import type { Payload } from 'payload'

import { createAccount } from '@/platform/payload/testing/inMemoryPayload'

import type { NewPasskey } from '../domain/passkeys'

// Shared setup of the passkey store's tests against real Payload on an in-memory SQLite database
// (#1313). A test file mocks `server-only` itself, then boots Payload with
// `bootPayload` (`src/platform/payload/testing`) in `beforeAll`.

let counter = 0

/** A guest account, made with access bypassed; gives its id. */
export async function makeAccount(payload: Payload): Promise<number> {
  const n = ++counter
  return (await createAccount(payload, 'guest', `person-${n}`)).id
}

/** A passkey to save for an account, with a credential ID no other call makes. */
export function newPasskey(accountId: number, over: Partial<NewPasskey> = {}): NewPasskey {
  const n = ++counter
  return {
    accountId,
    credentialId: `credential-${n}`,
    publicKey: `public-key-${n}`,
    counter: 0,
    transports: ['internal', 'hybrid'],
    deviceType: 'multiDevice',
    backedUp: true,
    label: 'My phone',
    ...over,
  }
}

/** Seconds-free clock for the tests: a fixed moment and offsets from it. */
export const NOW = new Date('2026-11-19T12:00:00.000Z')
export const minutesAfter = (n: number): Date => new Date(NOW.getTime() + n * 60_000)
