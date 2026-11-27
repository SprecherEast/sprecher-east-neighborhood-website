import { describe, expect, it } from 'vitest'

import {
  formatChangeAmount,
  formatChangePercent,
  toChange,
  toChangeView,
  toRankedRows,
} from './change'
import { FIXTURES } from './fixtures'
import { parseChartSpec } from './spec'

describe('toChange', () => {
  it('gives the signed amount, the percent of the earlier figure and the direction', () => {
    expect(toChange(452_723_152, 477_749_698)).toEqual({
      amount: 25_026_546,
      percent: (25_026_546 / 452_723_152) * 100,
      direction: 'up',
    })
    expect(toChange(200, 150)).toMatchObject({ amount: -50, percent: -25, direction: 'down' })
    expect(toChange(5, 5)).toMatchObject({ amount: 0, percent: 0, direction: 'same' })
  })

  it('has no percent when there was nothing before', () => {
    expect(toChange(0, 10)).toEqual({ amount: 10, percent: null, direction: 'up' })
  })
})

describe('formatting a change', () => {
  it('writes the sign into the text, so colour and arrow are never the only cue', () => {
    expect(formatChangeAmount(25_026_546)).toBe('+$25M')
    expect(formatChangeAmount(-3_354_608)).toBe('−$3.4M')
    expect(formatChangeAmount(0)).toBe('$0')
    expect(formatChangePercent(5.527)).toBe('+5.5%')
    expect(formatChangePercent(-2.93)).toBe('−2.9%')
    expect(formatChangePercent(0)).toBe('0%')
    expect(formatChangePercent(null)).toBeNull()
  })

  it('does not show a sign of a change that rounds to nothing', () => {
    expect(formatChangePercent(0.04)).toBe('0%')
    expect(formatChangePercent(-0.04)).toBe('0%')
  })
})

describe('toChangeView', () => {
  const spec = (input: unknown) => {
    const parsed = parseChartSpec(input)
    if (parsed.kind !== 'stacked') throw new Error('not stacked')
    return parsed
  }

  it('compares the last row with the first and splits the last into shares', () => {
    const view = toChangeView(spec({ ...FIXTURES.borrowed, look: 'change' }))
    expect(view.latest).toEqual({ label: '2027 proposed', total: 272_207_463 })
    expect(view.earlier).toEqual({ label: '2026 adopted', total: 286_193_208 })
    expect(view.change.direction).toBe('down')
    expect(view.parts.map((p) => p.label)).toEqual(['Borrowed', 'Other sources'])
    expect(view.parts.reduce((sum, p) => sum + p.percent, 0)).toBeCloseTo(100, 6)
    expect(view.parts[1].pattern).toBe('hatch')
  })

  it('leaves out a part with nothing in the later row', () => {
    const view = toChangeView(
      spec({
        ...FIXTURES.operating,
        look: 'change',
        series: [
          { key: 'a', label: 'A', values: [10, 12] },
          { key: 'b', label: 'B', values: [5, 0] },
        ],
      }),
    )
    expect(view.parts.map((p) => p.key)).toEqual(['a'])
  })
})

describe('toRankedRows', () => {
  const bars = (data: { key: string; label: string; value: number; previous?: number }[]) => {
    const parsed = parseChartSpec({
      ...FIXTURES.bars,
      density: 'compact',
      previousLabel: '2026 adopted',
      scaleMax: undefined,
      data,
    })
    if (parsed.kind !== 'bar') throw new Error('not a bar')
    return parsed
  }
  const rows = Array.from({ length: 10 }, (_, i) => ({
    key: `k${i}`,
    label: `Row ${i}`,
    value: (i + 1) * 100,
    previous: (i + 1) * 100 - 10,
  }))

  it('ranks by value, scales every bar by the biggest, and works out each change', () => {
    const { visible } = toRankedRows(bars(rows))
    expect(visible[0]).toMatchObject({ key: 'k9', value: 1000, width: 100 })
    expect(visible[0].change).toMatchObject({ amount: 10, direction: 'up' })
    expect(visible[1].width).toBeCloseTo(90, 6)
  })

  it('keeps the first eight rows and puts the rest under the smaller pieces', () => {
    const { visible, smaller } = toRankedRows(bars(rows))
    expect(visible).toHaveLength(8)
    expect(smaller.map((r) => r.key)).toEqual(['k1', 'k0'])
  })

  it('uses the scale end the author set, so two charts compare', () => {
    const spec = bars(rows.slice(0, 2))
    const wide = { ...spec, scaleMax: 400 }
    expect(toRankedRows(wide).visible.map((r) => r.width)).toEqual([50, 25])
  })

  it('has no change for a row without an earlier amount', () => {
    const { visible } = toRankedRows(bars([{ key: 'a', label: 'A', value: 5 }]))
    expect(visible[0].change).toBeNull()
  })
})
