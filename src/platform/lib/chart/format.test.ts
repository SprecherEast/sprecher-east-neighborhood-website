import { describe, expect, it } from 'vitest'

import { formatValue, formatWholeDollars } from './format'

describe('formatValue', () => {
  it.each([
    [194_768_276, 'usd', '$194,768,276'],
    [90.04, 'usd', '$90.04'],
    [7.5, 'usd', '$7.50'],
    [0, 'usd', '$0'],
    [24.8, 'percent', '24.8%'],
    [47, 'percent', '47%'],
    [6.93, 'mills', '6.93 mills'],
    [1, 'mills', '1 mill'],
    [1234, 'count', '1,234'],
  ] as const)('%s as %s is %s', (value, unit, text) => {
    expect(formatValue(value, unit)).toBe(text)
  })

  it('writes dollars short on request', () => {
    expect(formatValue(194_768_276, 'usd', { compact: true })).toBe('$194.8M')
    expect(formatValue(10_000_000, 'usd', { compact: true })).toBe('$10M')
    expect(formatValue(4_775_499, 'usd', { compact: true })).toBe('$4.8M')
    expect(formatValue(7.5, 'usd', { compact: true })).toBe('$7.50')
  })
})

describe('formatWholeDollars', () => {
  it('rounds to whole dollars and never shows cents', () => {
    expect(formatWholeDollars(1385.6)).toBe('$1,386')
    expect(formatWholeDollars(1385.4)).toBe('$1,385')
    expect(formatWholeDollars(0)).toBe('$0')
  })
})
