import { vi } from 'vitest'

import type { RegistrationAnswer } from '../domain/addPasskey'

/**
 * Fakes of the data layer for the two steps of adding a passkey (#1314), shared by
 * `use-cases/addPasskey.start.test.ts` and `use-cases/addPasskey.finish.test.ts`. Each test file
 * names the modules with `vi.mock(path, async () => (await import(...)).modules.<name>)`, then
 * calls `resetFakes()` before each test. The real library and real Payload are in
 * `addPasskey.payload.test.ts`.
 */
export const data = {
  relyingParty: vi.fn(),
  getSignInSession: vi.fn(),
  countPasskeys: vi.fn(),
  listPasskeys: vi.fn(),
  getOrCreateUserHandle: vi.fn(),
  savePasskey: vi.fn(),
  createChallenge: vi.fn(),
  takeChallenge: vi.fn(),
  saveChallengeCookie: vi.fn(),
  takeChallengeCookie: vi.fn(),
  makeRegistrationOptions: vi.fn(),
  verifyNewPasskey: vi.fn(),
  sendEmailToAccount: vi.fn(),
  after: [] as Array<() => unknown>,
}

/** The module replacements, by the data module they stand for. */
export const modules = {
  next: { after: (run: () => unknown) => data.after.push(run) },
  settings: { getPasskeyRelyingParty: data.relyingParty },
  session: { getSignInSession: data.getSignInSession },
  passkeys: {
    countPasskeys: data.countPasskeys,
    listPasskeys: data.listPasskeys,
    getOrCreateUserHandle: data.getOrCreateUserHandle,
    savePasskey: data.savePasskey,
  },
  challenges: { createChallenge: data.createChallenge, takeChallenge: data.takeChallenge },
  cookie: {
    saveChallengeCookie: data.saveChallengeCookie,
    takeChallengeCookie: data.takeChallengeCookie,
  },
  webauthn: {
    makeRegistrationOptions: data.makeRegistrationOptions,
    verifyNewPasskey: data.verifyNewPasskey,
  },
  email: { sendEmailToAccount: data.sendEmailToAccount },
}

export const relyingParty = { id: 'sprecher-east.example', origin: 'https://sprecher-east.example' }
export const NOW = new Date('2026-11-19T12:00:00.000Z')
export const session = {
  accountId: 7,
  email: 'ada@example.com',
  signedInAt: new Date(NOW.getTime() - 60_000),
}
export const answer = { id: 'abc' } as RegistrationAnswer
export const verified = {
  credentialId: 'abc',
  publicKey: 'pk',
  counter: 0,
  transports: ['internal'],
  deviceType: 'multiDevice' as const,
  backedUp: true,
}

/** Everything works: a recent session, a good challenge for it, a verified answer. */
export function resetFakes(): void {
  for (const fn of Object.values(data)) if (typeof fn === 'function') fn.mockReset()
  data.after.length = 0
  data.relyingParty.mockReturnValue(relyingParty)
  data.getSignInSession.mockResolvedValue(session)
  data.countPasskeys.mockResolvedValue(0)
  data.listPasskeys.mockResolvedValue([{ credentialId: 'old', transports: ['usb'], label: 'x' }])
  data.getOrCreateUserHandle.mockResolvedValue('handle')
  data.makeRegistrationOptions.mockResolvedValue({ options: { challenge: 'c' }, challenge: 'c' })
  data.createChallenge.mockResolvedValue(12)
  data.takeChallengeCookie.mockResolvedValue(12)
  data.takeChallenge.mockResolvedValue({ id: 12, purpose: 'add', challenge: 'c', accountId: 7 })
  data.verifyNewPasskey.mockResolvedValue(verified)
  data.savePasskey.mockResolvedValue({ saved: true, id: 1 })
  data.sendEmailToAccount.mockResolvedValue(undefined)
}
