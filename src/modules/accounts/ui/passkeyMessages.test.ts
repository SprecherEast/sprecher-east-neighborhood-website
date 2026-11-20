import { describe, expect, it } from 'vitest'

import {
  PASSKEY_LOGIN_LABEL,
  toAddPasskeyNotice,
  toPasskeyLoginNotice,
  toRemovePasskeyNotice,
  type AddPasskeyOutcome,
  type PasskeyLoginOutcome,
  type RemovePasskeyOutcome,
} from './passkeyMessages'

const OUTCOMES: AddPasskeyOutcome[] = [
  'added',
  'cancelled',
  'sign-in-again',
  'cap',
  'already-here',
  'too-many',
  'offline',
  'failed',
]

describe('toAddPasskeyNotice', () => {
  it.each(OUTCOMES)('has a short, fixed message for %s', (outcome) => {
    const { text } = toAddPasskeyNotice(outcome)
    expect(text.length).toBeGreaterThan(10)
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(30)
    // The brand voice: "we" and "you", never "I"
    expect(text).not.toMatch(/\b(I|me|my)\b/)
  })

  it('is a success only for an added passkey, and an error only when something went wrong', () => {
    expect(toAddPasskeyNotice('added').tone).toBe('success')
    expect(toAddPasskeyNotice('cancelled').tone).toBe('info')
    expect(toAddPasskeyNotice('failed').tone).toBe('error')
    expect(toAddPasskeyNotice('offline').tone).toBe('error')
    expect(toAddPasskeyNotice('too-many').tone).toBe('error')
  })

  it('offers to log in again only for an old sign-in', () => {
    expect(OUTCOMES.filter((o) => toAddPasskeyNotice(o).logInAgain)).toEqual(['sign-in-again'])
  })
})

const LOGIN_OUTCOMES: PasskeyLoginOutcome[] = ['cancelled', 'too-many', 'offline', 'failed']

describe('toPasskeyLoginNotice', () => {
  it('says nothing when a prompt nobody asked for ends: the page stays as it was', () => {
    expect(toPasskeyLoginNotice('cancelled')).toBeNull()
  })

  it('after the button, explains in plain words and gives the way forward, claiming neither “none saved” nor “closed” (#1364)', () => {
    const notice = toPasskeyLoginNotice('cancelled', { pressed: true })
    expect(notice?.tone).toBe('info')
    expect(notice?.text).toBe(
      'No passkey was used. If you haven’t added one yet, log in below as usual, then add one from your account page.',
    )
    expect(notice?.text.split(/\s+/).length).toBeLessThanOrEqual(30)
    expect(notice?.text).not.toMatch(/\b(I|me|my)\b/)
  })

  it('keeps every other outcome the same whether or not the button was pressed', () => {
    for (const outcome of ['too-many', 'offline', 'failed'] as const) {
      expect(toPasskeyLoginNotice(outcome, { pressed: true })).toEqual(
        toPasskeyLoginNotice(outcome),
      )
    }
  })

  it.each(LOGIN_OUTCOMES.filter((outcome) => outcome !== 'cancelled'))(
    'has a short, fixed error message for %s',
    (outcome) => {
      const notice = toPasskeyLoginNotice(outcome)
      expect(notice?.tone).toBe('error')
      expect(notice?.text.length).toBeGreaterThan(10)
      expect(notice?.text.split(/\s+/).length).toBeLessThanOrEqual(30)
      expect(notice?.text).not.toMatch(/\b(I|me|my)\b/)
    },
  )

  it('gives one failure for a wrong passkey, an unknown one and a refused account, and names no account', () => {
    expect(toPasskeyLoginNotice('failed')?.text).toBe(
      'We couldn’t log you in with that passkey. Try again, or use your email and password.',
    )
  })

  it('names the button once: the added message takes its label from the one definition', () => {
    expect(toAddPasskeyNotice('added').text).toBe(
      `Passkey added. Next time, choose ${PASSKEY_LOGIN_LABEL}.`,
    )
  })
})

describe('toPasskeyLoginNotice with a code it does not know', () => {
  it('shows the one fixed failure, never the code', () => {
    const notice = toPasskeyLoginNotice('no such account' as PasskeyLoginOutcome)
    expect(notice?.text).toBe(toPasskeyLoginNotice('failed')?.text)
  })
})

describe('toRemovePasskeyNotice', () => {
  const REMOVE_OUTCOMES: RemovePasskeyOutcome[] = ['removed', 'sign-in-again', 'offline', 'failed']

  it.each(REMOVE_OUTCOMES)('has a short, fixed message for %s', (outcome) => {
    const { text } = toRemovePasskeyNotice(outcome)
    expect(text.length).toBeGreaterThan(10)
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(30)
    expect(text).not.toMatch(/\b(I|me|my)\b/)
  })

  it('says it is removed, as a success', () => {
    expect(toRemovePasskeyNotice('removed')).toEqual({
      tone: 'success',
      text: 'Passkey removed.',
      logInAgain: false,
    })
  })

  it('offers to log in again only for an old sign-in', () => {
    expect(toRemovePasskeyNotice('sign-in-again')).toMatchObject({
      tone: 'warning',
      logInAgain: true,
    })
    for (const outcome of ['removed', 'offline', 'failed'] as const) {
      expect(toRemovePasskeyNotice(outcome).logInAgain).toBe(false)
    }
  })
})
