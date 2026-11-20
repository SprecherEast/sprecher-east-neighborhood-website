import { describe, expect, it } from 'vitest'

import { toAddPasskeyNotice, type AddPasskeyOutcome } from './passkeyMessages'

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
