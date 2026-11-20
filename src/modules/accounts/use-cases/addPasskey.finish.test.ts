import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_PASSKEYS_PER_ACCOUNT } from '../domain/passkeys'
import { RECENT_SIGN_IN_WINDOW_MS } from '../domain/signInSession'
import {
  answer,
  data,
  NOW,
  relyingParty,
  resetFakes,
  session,
  verified,
} from '../testing/addPasskeyFakes'

// The second step of adding a passkey against fakes of the data layer: the order of the checks,
// and what each refusal answers. The first step is `addPasskey.start.test.ts`.

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

import { finishAddPasskey } from './addPasskey'

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  resetFakes()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('finishAddPasskey', () => {
  const finish = (label?: string) => finishAddPasskey({ answer, label })

  it('saves a good answer for the session’s account only, then sends the note after the response', async () => {
    expect(await finish('My phone')).toEqual({ ok: true })
    expect(data.takeChallenge).toHaveBeenCalledWith({ id: 12, purpose: 'add', now: NOW })
    expect(data.verifyNewPasskey).toHaveBeenCalledWith({ answer, challenge: 'c', relyingParty })
    expect(data.savePasskey).toHaveBeenCalledExactlyOnceWith({
      accountId: 7,
      ...verified,
      label: 'My phone',
    })
    expect(data.sendEmailToAccount).not.toHaveBeenCalled()
    await data.after[0]?.()
    expect(data.sendEmailToAccount).toHaveBeenCalledOnce()
    const [to, email] = data.sendEmailToAccount.mock.calls[0] ?? []
    expect(to).toBe('ada@example.com')
    expect(email.text).toContain('“My phone”')
  })

  it('gives an unnamed passkey the default label, and cleans a typed one', async () => {
    await finish(undefined)
    expect(data.savePasskey.mock.calls[0]?.[0].label).toBe('Sprecher East passkey')
    await finish('  Ada’s\n  laptop  ')
    expect(data.savePasskey.mock.calls[1]?.[0].label).toBe('Ada’s laptop')
  })

  it('still adds when the note can’t be sent, logging only the error’s class', async () => {
    data.sendEmailToAccount.mockRejectedValue(new Error('smtp ada@example.com down'))
    expect(await finish()).toEqual({ ok: true })
    await data.after[0]?.()
    expect(console.error).toHaveBeenCalledWith('Passkey added note failed on the server (Error)')
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('ada@')
  })

  it('is refused with the one failure when the switch is off, taking nothing', async () => {
    data.relyingParty.mockReturnValue(null)
    expect(await finish()).toEqual({ ok: false, failure: 'failed' })
    expect(data.takeChallenge).not.toHaveBeenCalled()
    expect(data.verifyNewPasskey).not.toHaveBeenCalled()
  })

  it('refuses a browser with no challenge cookie, an unknown, used or expired challenge, and checks nothing', async () => {
    data.takeChallengeCookie.mockResolvedValue(null)
    expect(await finish()).toEqual({ ok: false, failure: 'failed' })
    expect(data.takeChallenge).not.toHaveBeenCalled()
    data.takeChallengeCookie.mockResolvedValue(12)
    data.takeChallenge.mockResolvedValue(null)
    expect(await finish()).toEqual({ ok: false, failure: 'failed' })
    expect(data.verifyNewPasskey).not.toHaveBeenCalled()
    expect(data.savePasskey).not.toHaveBeenCalled()
  })

  it('refuses a challenge made for another account', async () => {
    data.takeChallenge.mockResolvedValue({ id: 12, purpose: 'add', challenge: 'c', accountId: 8 })
    expect(await finish()).toEqual({ ok: false, failure: 'failed' })
    expect(data.verifyNewPasskey).not.toHaveBeenCalled()
    expect(data.savePasskey).not.toHaveBeenCalled()
  })

  it('refuses a challenge that belongs to no account', async () => {
    data.takeChallenge.mockResolvedValue({
      id: 12,
      purpose: 'add',
      challenge: 'c',
      accountId: null,
    })
    expect(await finish()).toEqual({ ok: false, failure: 'failed' })
    expect(data.verifyNewPasskey).not.toHaveBeenCalled()
    expect(data.savePasskey).not.toHaveBeenCalled()
  })

  it('asks for a new sign-in when the session has aged past the window by the time of the answer', async () => {
    data.getSignInSession.mockResolvedValue({
      ...session,
      signedInAt: new Date(NOW.getTime() - RECENT_SIGN_IN_WINDOW_MS - 1),
    })
    expect(await finish()).toEqual({ ok: false, failure: 'sign-in-again' })
    expect(data.takeChallenge).toHaveBeenCalledOnce()
    expect(data.verifyNewPasskey).not.toHaveBeenCalled()
    expect(data.savePasskey).not.toHaveBeenCalled()
  })

  it('asks for a new sign-in when there is no session, still using up the browser’s challenge', async () => {
    data.getSignInSession.mockResolvedValue(null)
    expect(await finish()).toEqual({ ok: false, failure: 'sign-in-again' })
    expect(data.takeChallengeCookie).toHaveBeenCalled()
    expect(data.takeChallenge).toHaveBeenCalledWith({ id: 12, purpose: 'add', now: NOW })
    expect(data.savePasskey).not.toHaveBeenCalled()
  })

  it('stops at the window’s end during the add: a session that is recent at first and old when saving is refused', async () => {
    const start = NOW.getTime()
    const almost = new Date(start - RECENT_SIGN_IN_WINDOW_MS + 1000)
    data.getSignInSession.mockResolvedValue({ ...session, signedInAt: almost })
    data.verifyNewPasskey.mockImplementation(async () => {
      vi.setSystemTime(start + 5000)
      return verified
    })
    expect(await finish()).toEqual({ ok: false, failure: 'sign-in-again' })
    expect(data.savePasskey).not.toHaveBeenCalled()
  })

  it('refuses at the cap, and counts again right before saving', async () => {
    data.countPasskeys.mockResolvedValue(MAX_PASSKEYS_PER_ACCOUNT)
    expect(await finish()).toEqual({ ok: false, failure: 'cap' })
    expect(data.verifyNewPasskey).not.toHaveBeenCalled()

    // Under the cap at first; another add lands while this answer is being checked
    data.countPasskeys.mockResolvedValueOnce(MAX_PASSKEYS_PER_ACCOUNT - 1)
    data.countPasskeys.mockResolvedValueOnce(MAX_PASSKEYS_PER_ACCOUNT)
    expect(await finish()).toEqual({ ok: false, failure: 'cap' })
    expect(data.countPasskeys).toHaveBeenCalledTimes(3)
    expect(data.savePasskey).not.toHaveBeenCalled()
  })

  it('refuses an answer the adapter doesn’t verify, saving nothing', async () => {
    data.verifyNewPasskey.mockResolvedValue(null)
    expect(await finish()).toEqual({ ok: false, failure: 'failed' })
    expect(data.savePasskey).not.toHaveBeenCalled()
    expect(data.sendEmailToAccount).not.toHaveBeenCalled()
  })

  it('gives the one failure when anything throws, logging only the error’s class', async () => {
    data.savePasskey.mockRejectedValue(new RangeError('Failed query: insert … ada@example.com'))
    expect(await finish()).toEqual({ ok: false, failure: 'failed' })
    expect(console.error).toHaveBeenCalledWith('Passkey add failed on the server (RangeError)')
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('ada@')
  })
})
