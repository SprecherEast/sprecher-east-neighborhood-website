import { describe, expect, it } from 'vitest'

import { FIXTURES } from './fixtures'
import { parseChartSpec } from './spec'

describe('parseChartSpec: change-first and compact looks (#1503)', () => {
  const stacked = (extra: Record<string, unknown>) => ({ ...FIXTURES.borrowed, ...extra })

  it('accepts a two-row stacked chart in the change look', () => {
    expect(parseChartSpec(stacked({ look: 'change' })).kind).toBe('stacked')
  })

  it('refuses the change look for anything but two rows, five parts or non-dollars', () => {
    expect(() =>
      parseChartSpec(stacked({ look: 'change', x: ['A', 'B', 'C'], rowNotes: undefined })),
    ).toThrow(/two rows/)
    expect(() => parseChartSpec(stacked({ look: 'change', unit: 'count' }))).toThrow(/dollars/)
    const parts = ['a', 'b', 'c', 'd', 'e'].map((key) => ({ key, label: key, values: [1, 2] }))
    expect(() =>
      parseChartSpec(stacked({ look: 'change', series: parts, rowNotes: undefined })),
    ).toThrow(/at most 4 parts/)
  })

  it('accepts compact bars with an earlier amount and says what it is', () => {
    const bars = {
      ...FIXTURES.bars,
      density: 'compact',
      previousLabel: '2025',
      data: [{ key: 'a', label: 'A', value: 10, previous: 8 }],
    }
    expect(parseChartSpec(bars).kind).toBe('bar')
    expect(() => parseChartSpec({ ...bars, previousLabel: undefined })).toThrow(/earlier numbers/)
    expect(() => parseChartSpec({ ...bars, density: 'full' })).toThrow(/compact/)
    expect(() => parseChartSpec({ ...bars, unit: 'count' })).toThrow(/dollars/)
  })

  it('refuses a negative earlier amount', () => {
    const bars = {
      ...FIXTURES.bars,
      density: 'compact',
      previousLabel: '2025',
      data: [{ key: 'a', label: 'A', value: 10, previous: -1 }],
    }
    expect(() => parseChartSpec(bars)).toThrow()
  })
})
