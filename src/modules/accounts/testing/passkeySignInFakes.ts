import { vi } from 'vitest'

import type { AuthenticationAnswer } from '../domain/signInWithPasskey'

/**
 * Fakes of the data layer for the two steps of signing in with a passkey (#1315), for
 * `use-cases/signInWithPasskey.test.ts`. The test names the modules with
 * `vi.mock(path, async () => (await import('../testing/passkeySignInFakes')).modules.<name>)`, then
 * calls `resetFakes()` before each test. The real library and real Payload are in
 * `signInWithPasskey.payload.test.ts`.
 */
export const data = {
  relyingParty: vi.fn(),
  createChallenge: vi.fn(),
  takeChallenge: vi.fn(),
  saveChallengeCookie: vi.fn(),
  takeChallengeCookie: vi.fn(),
  makeAuthenticationOptions: vi.fn(),
  verifyPasskeyAnswer: vi.fn(),
  findPasskeyByCredentialId: vi.fn(),
  findUserHandle: vi.fn(),
  recordPasskeyUse: vi.fn(),
  findAccountById: vi.fn(),
  startSessionFor: vi.fn(),
}

/** The module replacements, by the data module they stand for. */
export const modules = {
  settings: { getPasskeyRelyingParty: data.relyingParty },
  challenges: { createChallenge: data.createChallenge, takeChallenge: data.takeChallenge },
  cookie: {
    saveChallengeCookie: data.saveChallengeCookie,
    takeChallengeCookie: data.takeChallengeCookie,
  },
  webauthn: {
    makeAuthenticationOptions: data.makeAuthenticationOptions,
    verifyPasskeyAnswer: data.verifyPasskeyAnswer,
  },
  passkeys: {
    findPasskeyByCredentialId: data.findPasskeyByCredentialId,
    findUserHandle: data.findUserHandle,
    recordPasskeyUse: data.recordPasskeyUse,
  },
  accounts: { findAccountById: data.findAccountById },
  session: { startSessionFor: data.startSessionFor },
}

export const NOW = new Date('2026-11-19T12:00:00.000Z')
export const relyingParty = { id: 'sprecher-east.example', origin: 'https://sprecher-east.example' }
export const FAILED = { ok: false, failure: 'failed' }
export const answer = {
  id: 'abc',
  rawId: 'abc',
  type: 'public-key',
  clientExtensionResults: {},
  response: { clientDataJSON: 'x', authenticatorData: 'y', signature: 'z', userHandle: 'handle-7' },
} as AuthenticationAnswer
export const passkey = {
  id: 3,
  accountId: 7,
  credentialId: 'abc',
  publicKey: 'AQID',
  counter: 4,
  transports: ['internal'],
}
export const account = { id: 7, role: 'resident', verified: true, lockedUntil: null }

export const resetFakes = () => {
  for (const fn of Object.values(data)) fn.mockReset()
  data.relyingParty.mockReturnValue(relyingParty)
  data.makeAuthenticationOptions.mockResolvedValue({ options: { challenge: 'c' }, challenge: 'c' })
  data.createChallenge.mockResolvedValue(12)
  data.takeChallengeCookie.mockResolvedValue(12)
  data.takeChallenge.mockResolvedValue({
    id: 12,
    purpose: 'sign-in',
    challenge: 'c',
    accountId: null,
  })
  data.findPasskeyByCredentialId.mockResolvedValue(passkey)
  data.verifyPasskeyAnswer.mockResolvedValue({ credentialId: 'abc', newCounter: 5 })
  data.findAccountById.mockResolvedValue(account)
  data.findUserHandle.mockResolvedValue('handle-7')
  data.recordPasskeyUse.mockResolvedValue({ counterRaised: true })
  data.startSessionFor.mockResolvedValue(undefined)
}
