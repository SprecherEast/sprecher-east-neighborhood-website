import { describe, expect, it } from 'vitest'

import {
  PASSKEY_LOGIN_LABEL,
  toAddPasskeyNotice,
  toPasskeyLoginNotice,
  type AddPasskeyOutcome,
  type PasskeyLoginOutcome,
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
  it('says nothing when the person closed the prompt: the page stays as it was', () => {
    expect(toPasskeyLoginNotice('cancelled')).toBeNull()
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

  it('uses the same verb as the rest of the log in page, and as the card that adds a passkey', () => {
    expect(PASSKEY_LOGIN_LABEL).toBe('Log in with a passkey')
    expect(toAddPasskeyNotice('added').text).toContain(PASSKEY_LOGIN_LABEL)
  })
})

describe('toPasskeyLoginNotice with a code it does not know', () => {
  it('shows the one fixed failure, never the code', () => {
    const notice = toPasskeyLoginNotice('no such account' as PasskeyLoginOutcome)
    expect(notice?.text).toBe(toPasskeyLoginNotice('failed')?.text)
  })
})
