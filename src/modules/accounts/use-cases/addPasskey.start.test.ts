import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_PASSKEYS_PER_ACCOUNT, RECENT_SIGN_IN_WINDOW_MS } from '../domain/passkeys'
import { PASSKEY_OPTIONS_LIMITS } from '../domain/requestLimits'
import { data, NOW, relyingParty, resetFakes, session } from '../testing/addPasskeyFakes'

// The first step of adding a passkey against fakes of the data layer: who may ask for options and
// what each refusal answers. The second step is `addPasskey.finish.test.ts`.

vi.mock('next/server', async () => (await import('../testing/addPasskeyFakes')).modules.next)
vi.mock(
  '../data/passkeySettings',
  async () => (await import('../testing/addPasskeyFakes')).modules.settings,
)
vi.mock('../data/session', async () => (await import('../testing/addPasskeyFakes')).modules.session)
vi.mock(
  '../data/passkeys',
  async () => (await import('../testing/addPasskeyFakes')).modules.passkeys,
)
vi.mock(
  '../data/passkeyChallenges',
  async () => (await import('../testing/addPasskeyFakes')).modules.challenges,
)
vi.mock(
  '../data/passkeyChallengeCookie',
  async () => (await import('../testing/addPasskeyFakes')).modules.cookie,
)
vi.mock(
  '../data/webauthn',
  async () => (await import('../testing/addPasskeyFakes')).modules.webauthn,
)
vi.mock(
  '../data/accountEmail',
  async () => (await import('../testing/addPasskeyFakes')).modules.email,
)

import { startAddPasskey } from './addPasskey'

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  resetFakes()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('startAddPasskey', () => {
  it('gives the library’s options for the session’s own account, storing a challenge tied to this browser', async () => {
    expect(await startAddPasskey('1.2.3.4')).toEqual({ ok: true, options: { challenge: 'c' } })
    expect(data.getOrCreateUserHandle).toHaveBeenCalledWith(7)
    expect(data.makeRegistrationOptions).toHaveBeenCalledWith({
      relyingParty,
      userName: 'Sprecher East passkey',
      userHandle: 'handle',
      existing: [{ credentialId: 'old', transports: ['usb'] }],
    })
    expect(data.createChallenge).toHaveBeenCalledWith({
      purpose: 'add',
      challenge: 'c',
      accountId: 7,
      now: NOW,
    })
    expect(data.saveChallengeCookie).toHaveBeenCalledWith(12, NOW)
  })

  it('is refused with the one failure, and the library not called, when the switch is off', async () => {
    data.relyingParty.mockReturnValue(null)
    expect(await startAddPasskey(null)).toEqual({ ok: false, failure: 'failed' })
    expect(data.getSignInSession).not.toHaveBeenCalled()
    expect(data.makeRegistrationOptions).not.toHaveBeenCalled()
  })

  it.each([
    ['nobody signed in', null],
    [
      'a session older than the window',
      { ...session, signedInAt: new Date(NOW.getTime() - RECENT_SIGN_IN_WINDOW_MS - 1) },
    ],
  ])('asks for a new sign-in for %s, making nothing', async (_name, current) => {
    data.getSignInSession.mockResolvedValue(current)
    expect(await startAddPasskey('1.2.3.4')).toEqual({ ok: false, failure: 'sign-in-again' })
    expect(data.makeRegistrationOptions).not.toHaveBeenCalled()
    expect(data.createChallenge).not.toHaveBeenCalled()
    expect(data.saveChallengeCookie).not.toHaveBeenCalled()
  })

  it('refuses an account that has the most passkeys', async () => {
    data.countPasskeys.mockResolvedValue(MAX_PASSKEYS_PER_ACCOUNT)
    expect(await startAddPasskey('1.2.3.4')).toEqual({ ok: false, failure: 'cap' })
    expect(data.createChallenge).not.toHaveBeenCalled()
  })

  it('limits each connection, then answers too many', async () => {
    const answers = []
    for (let i = 0; i < 11; i++) {
      data.getSignInSession.mockResolvedValue({ ...session, accountId: 300 + i })
      answers.push(await startAddPasskey('9.9.9.9'))
    }
    expect(answers.slice(0, 10).every((a) => a.ok)).toBe(true)
    expect(answers[10]).toEqual({ ok: false, failure: 'too-many' })
    data.getSignInSession.mockResolvedValue({ ...session, accountId: 399 })
    expect(await startAddPasskey('8.8.8.8')).toMatchObject({ ok: true })
  })

  it('limits each account across connections, without blocking another account or any connection', async () => {
    const results = []
    data.getSignInSession.mockResolvedValue({ ...session, accountId: 400 })
    for (let i = 0; i < 11; i++) results.push(await startAddPasskey(`10.0.0.${i}`))
    expect(results.slice(0, 10).every((a) => a.ok)).toBe(true)
    expect(results[10]).toEqual({ ok: false, failure: 'too-many' })

    // Another account, on the same fresh connection the first was refused on, is not blocked
    data.getSignInSession.mockResolvedValue({ ...session, accountId: 8 })
    expect(await startAddPasskey('10.0.0.10')).toMatchObject({ ok: true })
    expect(PASSKEY_OPTIONS_LIMITS).not.toHaveProperty('siteWide')
  })
})
