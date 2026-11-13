import { describe, expect, it } from 'vitest'

import type { ChartSpec } from '@/platform/lib/chart/spec'

import { toCityTax } from './cityTax'

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

describe('toCityTax', () => {
  it('gives the City’s tax on the home as whole dollars, and the increase as given', () => {
    const tax = toCityTax(SPEC, { column: 1, cityAmount: 1386, increase: 36 })
    expect(tax).toEqual({ total: '$1,386', increase: 36 })
  })

  it('takes the increase from what it is given, not from the chart’s own figures (#1121)', () => {
    // The chart says 90.04 on 3,375.89; the rates price the increase at 91
    const tax = toCityTax(SPEC, { column: 1, cityAmount: 3467.08, increase: 91 })
    expect(tax).toEqual({ total: '$3,467', increase: 91 })
  })

  it('reports no increase in a year whose chart column has none', () => {
    const tax = toCityTax(SPEC, { column: 0, cityAmount: 1300, increase: 0 })
    expect(tax).toEqual({ total: '$1,300', increase: 0 })
  })

  it('scales the chart’s column by the home’s share of the average home when the City’s tax is not known', () => {
    const tax = toCityTax(SPEC, { column: 1, cityAmount: null, increase: null, homeRatio: 0.5 })
    expect(tax.total).toBe('$1,733')
  })

  it('reports no increase when the data cannot support one (#1121)', () => {
    const tax = toCityTax(SPEC, { column: 1, cityAmount: 3467, increase: null })
    expect(tax).toEqual({ total: '$3,467', increase: null })
  })

  it('reports the increase in whole dollars, never below 0 or above the whole tax', () => {
    expect(toCityTax(SPEC, { column: 1, cityAmount: 1386, increase: 36.4 }).increase).toBe(36)
    expect(toCityTax(SPEC, { column: 1, cityAmount: 1386, increase: -5 }).increase).toBe(0)
    expect(toCityTax(SPEC, { column: 1, cityAmount: 1386, increase: 9999 }).increase).toBe(1386)
  })

  it('takes a chart of increases alone as the whole tax being the increase', () => {
    const only: Stacked = { ...SPEC, series: SPEC.series.filter((series) => series.increase) }
    expect(toCityTax(only, { column: 1, cityAmount: 500, increase: 20 }).increase).toBe(500)
  })
})

describe('toCityTax between two years (#1096)', () => {
  it('blends the two columns, so the tax can count from one year to the next', () => {
    const half = toCityTax(SPEC, { column: 0.5, cityAmount: 3421, increase: 45.5 })
    expect(half).toEqual({ total: '$3,421', increase: 46 })
    // With no tax known, the blended column is what is scaled
    expect(toCityTax(SPEC, { column: 0.5, cityAmount: null, increase: 0 }).total).toBe('$3,421')
  })

  it('is exactly a year’s column at a whole position', () => {
    expect(toCityTax(SPEC, { column: 1, cityAmount: 1386, increase: 36 })).toEqual(
      toCityTax(SPEC, { column: 1.0, cityAmount: 1386, increase: 36 }),
    )
  })
})
