import { describe, expect, it } from 'vitest'

import { ACCOUNTS_MESSAGES } from './accounts'
import { MESSAGES } from './catalog'
import { CONTACT_MESSAGES } from './contact'
import { message } from './index'

describe('the message catalog', () => {
  it('keeps each message short enough to read on a phone', () => {
    for (const [key, sentence] of Object.entries(MESSAGES)) {
      expect(sentence.split(/\s+/).length, key).toBeLessThanOrEqual(30)
    }
  })

  it('has no hard-coded times: durations are blanks', () => {
    for (const [key, sentence] of Object.entries(MESSAGES)) {
      expect(sentence, key).not.toMatch(/\b(\d+|one|two|three|24|an?)\s+(hours?|days?|minutes?)\b/i)
    }
  })

  it('never lets one area overwrite another’s key', () => {
    expect(Object.keys(MESSAGES)).toHaveLength(
      Object.keys(CONTACT_MESSAGES).length + Object.keys(ACCOUNTS_MESSAGES).length,
    )
  })

  it('fills the contact line', () => {
    expect(message('contact.sent.checkEmail', { linkLifetime: 'a day' })).toBe(
      'Check your email. First time writing? Tap the link within a day so your message reaches us.',
    )
  })
})
