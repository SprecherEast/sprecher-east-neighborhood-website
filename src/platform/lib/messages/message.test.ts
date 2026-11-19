import { describe, expect, it } from 'vitest'

import { fillBlanks } from './message'

describe('fillBlanks', () => {
  it('fills each named blank', () => {
    expect(fillBlanks('Open it within {linkLifetime}.', { linkLifetime: 'a day' })).toBe(
      'Open it within a day.',
    )
  })

  it('leaves a sentence without blanks as it is', () => {
    expect(fillBlanks('Thanks, neighbor!', {})).toBe('Thanks, neighbor!')
  })

  it('throws on a blank with no value, so a message never ships with a hole', () => {
    expect(() => fillBlanks('Within {linkLifetime}.', {})).toThrow(/linkLifetime/)
  })
})
