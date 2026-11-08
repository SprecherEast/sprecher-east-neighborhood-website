import { describe, expect, it } from 'vitest'

import { formatMillions, formatShare, formatSquareValue, toBreakdown } from './breakdown'
import { FIXTURES } from './fixtures'
import { parseChartSpec } from './spec'

const spec = parseChartSpec(FIXTURES.dayToDay)
const capital = parseChartSpec(FIXTURES.bigProject)
const breakdownOf = (input: typeof spec) => {
  if (input.kind !== 'breakdown') throw new Error('not a breakdown')
  return toBreakdown(input)
}

describe('toBreakdown', () => {
  it('ranks the areas biggest first, whatever order they were written in', () => {
    const { areas } = breakdownOf(spec)
    const values = areas.map((a) => a.value)
    expect(values).toEqual([...values].sort((a, b) => b - a))
    expect(areas[0].label).toBe('Public safety & health')
  })

  it('gives the ramp step by rank: the biggest area is step 1, then one more each', () => {
    expect(breakdownOf(spec).areas.map((a) => a.step)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('fills the grid with one square per square value, rounded, and the areas add up to it', () => {
    const day = breakdownOf(spec)
    expect(day.squareCount).toBe(96)
    expect(day.areas.reduce((n, a) => n + a.squares, 0)).toBe(96)
    const big = breakdownOf(capital)
    expect(big.squareCount).toBe(54)
    expect(big.areas.reduce((n, a) => n + a.squares, 0)).toBe(54)
  })

  it('gives each area its share of the whole, in percent', () => {
    const { areas, total } = breakdownOf(spec)
    expect(total).toBeCloseTo(477_549_854, -1)
    expect(areas[0].share).toBeCloseTo(40.8, 1)
    expect(areas.reduce((sum, a) => sum + a.share, 0)).toBeCloseTo(100, 5)
  })

  it('shows the pieces marked as shown under their area, biggest first, in the area step', () => {
    const [first] = breakdownOf(spec).areas
    expect(first.shown.map((p) => p.label)).toEqual(['Police', 'Fire / EMS'])
    expect(first.shown.every((p) => p.step === first.step)).toBe(true)
    expect(first.shown[0].share).toBeCloseTo(21.5, 1)
  })

  it('folds every other piece into one list, biggest first, each naming its area', () => {
    const { smaller } = breakdownOf(spec)
    const values = smaller.map((p) => p.value)
    expect(values).toEqual([...values].sort((a, b) => b - a))
    expect(smaller[0]).toMatchObject({ label: 'Planning & development', area: 'Everything else' })
    expect(smaller.map((p) => p.label)).toContain('Public Health')
    expect(smaller.map((p) => p.label)).not.toContain('Police')
  })

  it('colours the smaller pieces by their own rank, spread over the seven steps', () => {
    const { smaller } = breakdownOf(spec)
    expect(smaller[0].step).toBe(1)
    expect(smaller.at(-1)?.step).toBe(7)
    const steps = smaller.map((p) => p.step)
    expect(steps).toEqual([...steps].sort((a, b) => a - b))
  })

  it('has no smaller pieces when every piece is shown or there are none', () => {
    expect(breakdownOf(parseChartSpec(FIXTURES.bigProject)).smaller.length).toBeGreaterThan(0)
    const plain = parseChartSpec({
      ...FIXTURES.dayToDay,
      areas: [{ key: 'a', label: 'A', value: 10_000_000 }],
    })
    expect(breakdownOf(plain).smaller).toEqual([])
  })
})

describe('formatMillions and formatShare', () => {
  it('writes millions short: whole from 100M, one decimal below', () => {
    expect(formatMillions(194_768_276)).toBe('$195M')
    expect(formatMillions(37_858_292)).toBe('$37.9M')
    expect(formatMillions(5_000_000)).toBe('$5.0M')
  })

  it('does not call an amount under a million "$0.5M"', () => {
    expect(formatMillions(500_000)).toBe('$500,000')
  })

  it('writes a share with one decimal', () => {
    expect(formatShare(40.783)).toBe('40.8%')
  })
})

describe('formatSquareValue', () => {
  it('writes what a square is worth in words', () => {
    expect(formatSquareValue(5_000_000)).toBe('$5 million')
    expect(formatSquareValue(2_500_000)).toBe('$2.5 million')
    expect(formatSquareValue(250_000)).toBe('$250,000')
  })
})
