import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_PASSKEYS_PER_ACCOUNT, RECENT_SIGN_IN_WINDOW_MS } from '../domain/passkeys'
import { PASSKEY_OPTIONS_LIMITS } from '../domain/requestLimits'

// The two steps of adding a passkey against fakes of the data layer: who may, in what order, and
// what each refusal answers. The real library and real Payload are in `addPasskey.payload.test.ts`.
const data = vi.hoisted(() => ({
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
}))
vi.mock('next/server', () => ({ after: (run: () => unknown) => data.after.push(run) }))
vi.mock('../data/passkeySettings', () => ({ getPasskeyRelyingParty: data.relyingParty }))
vi.mock('../data/session', () => ({ getSignInSession: data.getSignInSession }))
vi.mock('../data/passkeys', () => ({
  countPasskeys: data.countPasskeys,
  listPasskeys: data.listPasskeys,
  getOrCreateUserHandle: data.getOrCreateUserHandle,
  savePasskey: data.savePasskey,
}))
vi.mock('../data/passkeyChallenges', () => ({
  createChallenge: data.createChallenge,
  takeChallenge: data.takeChallenge,
}))
vi.mock('../data/passkeyChallengeCookie', () => ({
  saveChallengeCookie: data.saveChallengeCookie,
  takeChallengeCookie: data.takeChallengeCookie,
}))
vi.mock('../data/webauthn', () => ({
  makeRegistrationOptions: data.makeRegistrationOptions,
  verifyNewPasskey: data.verifyNewPasskey,
}))
vi.mock('../data/accountEmail', () => ({ sendEmailToAccount: data.sendEmailToAccount }))

import type { RegistrationAnswer } from '../domain/addPasskey'
import { finishAddPasskey, startAddPasskey } from './addPasskey'

const relyingParty = { id: 'sprecher-east.example', origin: 'https://sprecher-east.example' }
const NOW = new Date('2026-11-19T12:00:00.000Z')
const recent = new Date(NOW.getTime() - 60_000)
const session = { accountId: 7, email: 'ada@example.com', signedInAt: recent }
const answer = { id: 'abc' } as RegistrationAnswer
const verified = {
  credentialId: 'abc',
  publicKey: 'pk',
  counter: 0,
  transports: ['internal'],
  deviceType: 'multiDevice' as const,
  backedUp: true,
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
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
})
afterEach(() => {
  vi.useRealTimers()
  for (const fn of Object.values(data))
    if (typeof fn === 'function' && 'mockReset' in fn) fn.mockReset()
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
