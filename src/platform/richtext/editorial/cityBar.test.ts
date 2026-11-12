import { describe, expect, it } from 'vitest'

import type { ChartSpec } from '@/platform/lib/chart/spec'

import { toCityBar } from './cityBar'

type Stacked = Extract<ChartSpec, { kind: 'stacked' }>

const SPEC: Stacked = {
  kind: 'stacked',
  title: 'City tax on an average home',
  summary: 'Up $90.',
  unit: 'usd',
  orientation: 'horizontal',
  x: ['2026 adopted', '2027 proposed'],
  series: [
    { key: 'same', label: 'Same as 2026', values: [3375.89, 3375.89] },
    {
      key: 'more',
      label: 'Proposed increase',
      pattern: 'hatch',
      increase: true,
      values: [0, 90.04],
    },
  ],
}

describe('toCityBar', () => {
  it('shows the column of the year, the increase as given and the rest split as the chart splits it, summing to the City’s tax', () => {
    const bar = toCityBar(SPEC, { column: 1, cityAmount: 1386, increase: 36 })
    expect(bar.title).toBe('2027 proposed')
    expect(bar.total).toBe('$1,386')
    expect(bar.parts.map((p) => p.amount)).toEqual(['$1,350', '+$36'])
    expect(bar.parts.map((p) => p.hatch)).toEqual([false, true])
  })

  it('takes the increase from what it is given, not from the chart’s own figures (#1121)', () => {
    // The chart says 90.04 on 3,375.89; the rates price the increase at 91, so the bar shows 91
    const bar = toCityBar(SPEC, { column: 1, cityAmount: 3467.08, increase: 91 })
    expect(bar.parts.map((p) => p.amount)).toEqual(['$3,376', '+$91'])
    expect(bar.increase).toBe(91)
  })

  it('makes the rounded parts add up to the rounded whole, never a dollar off', () => {
    const bar = toCityBar(SPEC, { column: 1, cityAmount: 2000.5, increase: 53.4 })
    const sum = bar.parts.reduce((all, p) => all + Number(p.amount.replace(/[^0-9]/g, '')), 0)
    expect(sum).toBe(Number(bar.total.replace(/[^0-9]/g, '')))
  })

  it('leaves out a part that is nothing that year, so 2026 has no increase', () => {
    const bar = toCityBar(SPEC, { column: 0, cityAmount: 1300, increase: 0 })
    expect(bar.title).toBe('2026 adopted')
    expect(bar.parts).toHaveLength(1)
    expect(bar.parts[0]?.hatch).toBe(false)
    expect(bar.total).toBe('$1,300')
  })

  it('scales by the home’s share of the chart’s average home when the City’s tax is not known', () => {
    const bar = toCityBar(SPEC, { column: 1, cityAmount: null, increase: null, homeRatio: 0.5 })
    expect(bar.total).toBe('$1,733')
  })

  it('draws no increase part and reports none when the data cannot support one (#1121)', () => {
    const bar = toCityBar(SPEC, { column: 1, cityAmount: 3467, increase: null })
    expect(bar.increase).toBeNull()
    expect(bar.parts).toHaveLength(1)
    expect(bar.parts[0]?.amount).toBe('$3,467')
  })

  it('reports the increase as the whole dollars it shows, never below 0 or above the whole', () => {
    expect(toCityBar(SPEC, { column: 1, cityAmount: 1386, increase: 36.4 }).increase).toBe(36)
    expect(toCityBar(SPEC, { column: 1, cityAmount: 1386, increase: -5 }).increase).toBe(0)
    expect(toCityBar(SPEC, { column: 1, cityAmount: 1386, increase: 9999 }).increase).toBe(1386)
  })

  it('draws a chart of increases alone as the whole increase', () => {
    const only: Stacked = { ...SPEC, series: SPEC.series.filter((series) => series.increase) }
    const bar = toCityBar(only, { column: 1, cityAmount: 500, increase: 20 })
    expect(bar.parts.map((p) => p.amount)).toEqual(['+$500'])
  })
})

describe('toCityBar between two years (#1096)', () => {
  it('blends the two columns, so the bar can count from one year to the next', () => {
    const half = toCityBar(SPEC, { column: 0.5, cityAmount: 3421, increase: 45.5 })
    // The increase is half of the later year's, on top of the rest of the City's tax
    expect(half.parts.map((p) => p.amount)).toEqual(['$3,375', '+$46'])
    expect(half.increase).toBe(46)
  })

  it('names the nearer year', () => {
    expect(toCityBar(SPEC, { column: 0.4, cityAmount: null, increase: 0 }).title).toBe(
      '2026 adopted',
    )
    expect(toCityBar(SPEC, { column: 0.6, cityAmount: null, increase: 0 }).title).toBe(
      '2027 proposed',
    )
  })

  it('is exactly a year’s column at a whole position', () => {
    expect(toCityBar(SPEC, { column: 1, cityAmount: 1386, increase: 36 })).toEqual(
      toCityBar(SPEC, { column: 1.0, cityAmount: 1386, increase: 36 }),
    )
  })
})
