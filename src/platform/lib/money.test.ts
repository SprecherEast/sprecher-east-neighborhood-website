import { describe, expect, it } from 'vitest'

import { caretAfterDigits, formatMoneyTyping } from './money'

describe('formatMoneyTyping', () => {
  it.each([
    ['', ''],
    ['abc', ''],
    ['5', '$5'],
    ['500300', '$500,300'],
    ['$500,3000', '$5,003,000'],
    ['$1,250,000', '$1,250,000'],
    ['  12 34 ', '$1,234'],
    ['$1,250,000.99', '$1,250,000'],
    ['.5', ''],
    ['007', '$7'],
    ['$0', '$0'],
  ])('%j is written %j', (typed, written) => {
    expect(formatMoneyTyping(typed)).toBe(written)
  })

  it('writes a value past the supported size as it is, for the box’s own error to catch', () => {
    expect(formatMoneyTyping('999999999999')).toBe('$999,999,999,999')
  })
})

describe('formatMoneyTyping while the reader deletes (#1172)', () => {
  it.each([
    ['$00,000', '$00,000'],
    ['$005', '$005'],
    ['$0', '$0'],
    ['', ''],
    ['$1,250,000', '$1,250,000'],
  ])('keeps the zeros left in front: %j is written %j', (typed, written) => {
    expect(formatMoneyTyping(typed, { keepLeadingZeros: true })).toBe(written)
  })

  it('still drops them when told nothing, so a pasted 007 is $7', () => {
    expect(formatMoneyTyping('007')).toBe('$7')
  })
})

describe('caretAfterDigits', () => {
  it('puts the caret after the same number of digits it followed before', () => {
    // typed a 5 in the middle of "$1,2|00" → "$1,25|00" → "$12,500" keeps it after the 5
    expect(caretAfterDigits('$12,500', 3)).toBe(5)
    expect(caretAfterDigits('$12,500', 0)).toBe(1)
    expect(caretAfterDigits('$12,500', 5)).toBe(7)
  })

  it('lands at the end when there are more digits than the text holds', () => {
    expect(caretAfterDigits('$12', 9)).toBe(3)
    expect(caretAfterDigits('', 0)).toBe(0)
  })
})
