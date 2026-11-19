import { describe, expect, it } from 'vitest'

import { CHART_PALETTE, CHART_RAMP, rampAt, slotAt } from './chartPalette'

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

describe('the breakdown ramp', () => {
  it('has seven steps, each with its own classes', () => {
    expect(CHART_RAMP).toHaveLength(7)
    expect(rampAt(1).bg).toBe('bg-chart-ramp-1')
    expect(rampAt(7).fill).toBe('fill-chart-ramp-7')
    expect(new Set(CHART_RAMP.map((step) => step.bg)).size).toBe(7)
  })

  it('refuses a step outside 1 to 7', () => {
    expect(() => rampAt(0)).toThrow(RangeError)
    expect(() => rampAt(8)).toThrow(/1 to 7/)
  })
})
