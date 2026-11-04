import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { toBarModel } from './barModel'

describe('toBarModel', () => {
  it('turns each datum of a bar chart into a row of one segment, in the first colour', () => {
    const model = toBarModel(parseChartSpec(FIXTURES.bars))
    expect(model.rows.map((r) => r.label)).toEqual(['2026 adopted', '2027 proposed'])
    expect(model.rows.map((r) => r.segments.length)).toEqual([1, 1])
    expect(model.rows.map((r) => r.segments[0].slotIndex)).toEqual([0, 0])
    expect(model.rows.map((r) => r.segments[0].hatch)).toEqual([false, true])
    expect(model.rows.map((r) => r.totalText)).toEqual(['$452.7M', '$477.5M'])
  })

  it('uses the spec’s scaleMax, or the longest row when there is none', () => {
    expect(toBarModel(parseChartSpec(FIXTURES.bars)).scaleMax).toBe(500_000_000)
    const { scaleMax: _unused, ...withoutScale } = FIXTURES.bars
    expect(toBarModel(parseChartSpec(withoutScale)).scaleMax).toBe(477_549_853)
  })

  it('turns each x of a stacked chart into a row, one segment per series, coloured by position', () => {
    const model = toBarModel(parseChartSpec(FIXTURES.borrowed))
    expect(model.rows.map((r) => r.label)).toEqual(['2026 adopted', '2027 proposed'])
    expect(model.rows[1].segments.map((s) => [s.key, s.slotIndex, s.hatch, s.valueText])).toEqual([
      ['borrowed', 0, false, '$179.8M'],
      ['other', 1, true, '$92.4M'],
    ])
    expect(model.rows.map((r) => r.totalText)).toEqual(['$286.2M', '$272.2M'])
    expect(model.rows.map((r) => r.note)).toEqual([
      '$60 of every $100 is borrowed',
      '$66 of every $100 is borrowed',
    ])
  })

  it('writes an increase with a plus sign, dollars first', () => {
    const model = toBarModel(parseChartSpec(FIXTURES.operating))
    expect(model.rows[1].segments.map((s) => s.valueText)).toEqual(['$452.7M', '+$24.8M'])
    expect(model.rows[1].totalText).toBe('$477.5M')
  })

  it('colours an increase like the first series, hatched, so it reads as more of the same', () => {
    const [, row] = toBarModel(parseChartSpec(FIXTURES.operating)).rows
    expect(row.segments.map((s) => [s.slotIndex, s.hatch])).toEqual([
      [0, false],
      [0, true],
    ])
  })

  it('keeps a zero segment as a mark but gives it no label', () => {
    const [first] = toBarModel(parseChartSpec(FIXTURES.operating)).rows
    expect(first.segments).toHaveLength(2)
    expect(first.segments[1].value).toBe(0)
    expect(first.segments[1].valueText).toBe('')
  })

  it('refuses a vertical chart: this adapter draws horizontal bars', () => {
    expect(() => toBarModel(parseChartSpec({ ...FIXTURES.bars, orientation: 'vertical' }))).toThrow(
      /horizontal/,
    )
  })
})
