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
  it('shows the column of the year, split as the chart splits it, summing to the City’s tax', () => {
    const bar = toCityBar(SPEC, { column: 1, cityAmount: 1386 })
    expect(bar.title).toBe('2027 proposed')
    expect(bar.total).toBe('$1,386')
    expect(bar.parts.map((p) => p.amount)).toEqual(['$1,350', '+$36'])
    expect(bar.parts.map((p) => p.hatch)).toEqual([false, true])
  })

  it('makes the rounded parts add up to the rounded whole, never a dollar off', () => {
    const bar = toCityBar(SPEC, { column: 1, cityAmount: 2000.5 })
    const sum = bar.parts.reduce((all, p) => all + Number(p.amount.replace(/[^0-9]/g, '')), 0)
    expect(sum).toBe(Number(bar.total.replace(/[^0-9]/g, '')))
  })

  it('leaves out a part that is nothing in that year, so 2026 has no increase', () => {
    const bar = toCityBar(SPEC, { column: 0, cityAmount: 1300 })
    expect(bar.title).toBe('2026 adopted')
    expect(bar.parts).toHaveLength(1)
    expect(bar.parts[0]?.hatch).toBe(false)
    expect(bar.total).toBe('$1,300')
  })

  it('scales by the home’s share of the chart’s average home when the City’s tax is not known', () => {
    const bar = toCityBar(SPEC, { column: 1, cityAmount: null, homeRatio: 0.5 })
    expect(bar.total).toBe('$1,733')
  })

  it('reports the increase as the rounded sum of the increase parts, the figure the bar shows', () => {
    expect(toCityBar(SPEC, { column: 1, cityAmount: 1386 }).increase).toBe(36)
    expect(toCityBar(SPEC, { column: 0, cityAmount: 1386 }).increase).toBe(0)
  })
})
