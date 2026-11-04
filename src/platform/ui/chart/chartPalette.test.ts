import { describe, expect, it } from 'vitest'

import { CHART_PALETTE, slotAt } from './chartPalette'

describe('chart palette', () => {
  it('has the six chart tokens, slot = position + 1, and no repeats', () => {
    expect(CHART_PALETTE.map((s) => s.slot)).toEqual([1, 2, 3, 4, 5, 6])
    expect(new Set(CHART_PALETTE.map((s) => s.bg)).size).toBe(6)
    expect(slotAt(CHART_PALETTE, 0).bg).toBe('bg-chart-1')
    expect(slotAt(CHART_PALETTE, 5).fill).toBe('fill-chart-6')
  })

  it('never cycles: a seventh part is an error', () => {
    expect(() => slotAt(CHART_PALETTE, 6)).toThrow(RangeError)
  })
})
