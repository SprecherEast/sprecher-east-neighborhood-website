import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PASSKEY_SIGN_IN_LIMITS } from '../domain/requestLimits'
import type { AuthenticationAnswer } from '../domain/signInWithPasskey'
import {
  account,
  answer,
  data,
  FAILED,
  NOW,
  relyingParty,
  resetFakes,
} from '../testing/passkeySignInFakes'

// Signing in with a passkey against fakes of the data layer: what each refusal answers and what a
// good answer does. The real library and real Payload are in `signInWithPasskey.payload.test.ts`.

vi.mock('server-only', () => ({}))
vi.mock(
  '../data/passkeySettings',
  async () => (await import('../testing/passkeySignInFakes')).modules.settings,
)
vi.mock(
  '../data/passkeyChallenges',
  async () => (await import('../testing/passkeySignInFakes')).modules.challenges,
)
vi.mock(
  '../data/passkeyChallengeCookie',
  async () => (await import('../testing/passkeySignInFakes')).modules.cookie,
)
vi.mock(
  '../data/webauthn',
  async () => (await import('../testing/passkeySignInFakes')).modules.webauthn,
)
vi.mock(
  '../data/passkeys',
  async () => (await import('../testing/passkeySignInFakes')).modules.passkeys,
)
vi.mock(
  '../data/socialAccounts',
  async () => (await import('../testing/passkeySignInFakes')).modules.accounts,
)
vi.mock(
  '../data/session',
  async () => (await import('../testing/passkeySignInFakes')).modules.session,
)

import { finishPasskeySignIn, startPasskeySignIn } from './signInWithPasskey'

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  resetFakes()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('startPasskeySignIn', () => {
  it('gives the library’s options, naming no account, with a challenge tied to this browser', async () => {
    expect(await startPasskeySignIn('1.2.3.4')).toEqual({ ok: true, options: { challenge: 'c' } })
    expect(data.makeAuthenticationOptions).toHaveBeenCalledExactlyOnceWith({ relyingParty })
    expect(data.createChallenge).toHaveBeenCalledExactlyOnceWith({
      purpose: 'sign-in',
      challenge: 'c',
      accountId: null,
      now: NOW,
    })
    expect(data.saveChallengeCookie).toHaveBeenCalledExactlyOnceWith(12, NOW)
  })

  it('is refused with the one failure, and the library not called, when the switch is off', async () => {
    data.relyingParty.mockReturnValue(null)
    expect(await startPasskeySignIn(null)).toEqual(FAILED)
    expect(data.makeAuthenticationOptions).not.toHaveBeenCalled()
    expect(data.createChallenge).not.toHaveBeenCalled()
  })

  it('answers the same fixed failure when the library or the store throws', async () => {
    data.makeAuthenticationOptions.mockRejectedValue(new Error('boom'))
    expect(await startPasskeySignIn(null)).toEqual(FAILED)
    data.makeAuthenticationOptions.mockResolvedValue({ options: {}, challenge: 'c' })
    data.createChallenge.mockRejectedValue(new Error('db down'))
    expect(await startPasskeySignIn(null)).toEqual(FAILED)
    expect(data.saveChallengeCookie).not.toHaveBeenCalled()
  })

  it('stores nothing and sets no cookie past the per-connection limit, and counts each connection alone', async () => {
    for (let i = 0; i < PASSKEY_SIGN_IN_LIMITS.perConnection; i++) {
      expect((await startPasskeySignIn('10.0.0.1')).ok).toBe(true)
    }
    data.createChallenge.mockClear()
    expect(await startPasskeySignIn('10.0.0.1')).toEqual({ ok: false, failure: 'too-many' })
    expect(data.createChallenge).not.toHaveBeenCalled()
    expect((await startPasskeySignIn('10.0.0.2')).ok).toBe(true)
  })

  it('stores nothing past the site-wide limit, from any connection', async () => {
    vi.resetModules()
    const { startPasskeySignIn: fresh } = await import('./signInWithPasskey')
    const { siteWide, perConnection } = PASSKEY_SIGN_IN_LIMITS
    // Fewer than the per-connection limit from each address, so only the site-wide count can refuse
    for (let n = 0; n < (siteWide as number); n++) {
      const connection = Math.floor(n / (perConnection - 1))
      expect((await fresh(`172.16.${connection >> 8}.${connection & 255}`)).ok).toBe(true)
    }
    data.createChallenge.mockClear()
    expect(await fresh('192.0.2.1')).toEqual({ ok: false, failure: 'too-many' })
    expect(data.createChallenge).not.toHaveBeenCalled()
  })
})

describe('finishPasskeySignIn', () => {
  const finish = (input: { answer?: AuthenticationAnswer; rememberMe?: boolean } = {}) =>
    finishPasskeySignIn({ answer, rememberMe: false, ...input })

  it('signs in the passkey’s owner only, after recording the use, and says so', async () => {
    expect(await finish()).toEqual({ ok: true })
    expect(data.takeChallenge).toHaveBeenCalledExactlyOnceWith({
      id: 12,
      purpose: 'sign-in',
      now: NOW,
    })
    expect(data.findPasskeyByCredentialId).toHaveBeenCalledExactlyOnceWith('abc')
    expect(data.verifyPasskeyAnswer).toHaveBeenCalledExactlyOnceWith({
      answer,
      challenge: 'c',
      relyingParty,
      credential: { credentialId: 'abc', publicKey: 'AQID', counter: 4, transports: ['internal'] },
    })
    expect(data.recordPasskeyUse).toHaveBeenCalledExactlyOnceWith(3, 5, NOW)
    expect(data.startSessionFor).toHaveBeenCalledExactlyOnceWith(7, { rememberMe: false })
    expect(data.recordPasskeyUse.mock.invocationCallOrder[0]).toBeLessThan(
      data.startSessionFor.mock.invocationCallOrder[0] as number,
    )
  })

  it('passes "Keep me signed in" on to the session', async () => {
    await finish({ rememberMe: true })
    expect(data.startSessionFor).toHaveBeenCalledExactlyOnceWith(7, { rememberMe: true })
  })

  it('takes the challenge from this browser’s cookie before anything else, so a failed answer uses it up', async () => {
    data.verifyPasskeyAnswer.mockResolvedValue(null)
    expect(await finish()).toEqual(FAILED)
    expect(data.takeChallengeCookie).toHaveBeenCalledOnce()
    expect(data.takeChallenge).toHaveBeenCalledOnce()
  })

  const refused: Array<[string, () => void]> = [
    ['the switch is off', () => data.relyingParty.mockReturnValue(null)],
    [
      'this browser has no challenge cookie',
      () => data.takeChallengeCookie.mockResolvedValue(null),
    ],
    [
      'the challenge was already used, expired or is another purpose',
      () => data.takeChallenge.mockResolvedValue(null),
    ],
    [
      'no passkey has that credential ID',
      () => data.findPasskeyByCredentialId.mockResolvedValue(null),
    ],
    [
      'the library refuses the answer (signature, origin, relying party, counter, frame)',
      () => data.verifyPasskeyAnswer.mockResolvedValue(null),
    ],
    ['the owner is gone', () => data.findAccountById.mockResolvedValue(null)],
    [
      'the owner is locked',
      () =>
        data.findAccountById.mockResolvedValue({
          ...account,
          lockedUntil: new Date(NOW.getTime() + 60_000),
        }),
    ],
    [
      'the owner is not verified',
      () => data.findAccountById.mockResolvedValue({ ...account, verified: false }),
    ],
    [
      'the owner is an agent',
      () => data.findAccountById.mockResolvedValue({ ...account, role: 'agent' }),
    ],
    [
      'the answer’s user handle is another account’s',
      () => data.findUserHandle.mockResolvedValue('handle-9'),
    ],
    ['the owner has no stored user handle', () => data.findUserHandle.mockResolvedValue(null)],
    [
      'the counter did not go up although it should have',
      () => data.recordPasskeyUse.mockResolvedValue({ counterRaised: false }),
    ],
    [
      'recording the use fails',
      () => data.recordPasskeyUse.mockRejectedValue(new Error('db down')),
    ],
    ['starting the session fails', () => data.startSessionFor.mockRejectedValue(new Error('boom'))],
  ]

  it.each(refused)('gives the one fixed failure when %s', async (_name, arrange) => {
    arrange()
    expect(await finish()).toEqual(FAILED)
  })

  it.each(refused.filter(([name]) => !name.includes('starting the session')))(
    'starts no session when %s',
    async (_name, arrange) => {
      arrange()
      await finish()
      expect(data.startSessionFor).not.toHaveBeenCalled()
    },
  )

  it('refuses an answer that names no user handle, and one that names another', async () => {
    const without = { ...answer, response: { ...answer.response, userHandle: undefined } }
    expect(await finish({ answer: without })).toEqual(FAILED)
    expect(data.startSessionFor).not.toHaveBeenCalled()
  })

  it('gives every refusal the same answer, so none says which check failed or whether an account exists', async () => {
    const answers = new Set<string>()
    for (const [, arrange] of refused) {
      resetFakes()
      arrange()
      answers.add(JSON.stringify(await finish()))
    }
    expect([...answers]).toEqual([JSON.stringify(FAILED)])
  })

  it('lets a synced passkey that reports zero through when the counter stays zero', async () => {
    data.verifyPasskeyAnswer.mockResolvedValue({ credentialId: 'abc', newCounter: 0 })
    data.recordPasskeyUse.mockResolvedValue({ counterRaised: false })
    expect(await finish()).toEqual({ ok: true })
  })

  it('logs only a fixed name, never the answer, the challenge or a key, when something throws', async () => {
    data.startSessionFor.mockRejectedValue(new Error('challenge c signature z'))
    await finish()
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).not.toContain('signature z')
    expect(logged).not.toContain('AQID')
  })
})
