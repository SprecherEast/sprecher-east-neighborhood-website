import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { toBarModel } from './barModel'
import { SEGMENT_GAP, VIEW_WIDTH, layoutBars, placeLabels, wrapText } from './barLayout'

const layout = (spec: unknown) => layoutBars(toBarModel(parseChartSpec(spec)))

describe('layoutBars', () => {
  it('draws the same value the same length in two charts with the same scaleMax', () => {
    const operating = layout(FIXTURES.bars)
    const capital = layout({ ...FIXTURES.borrowed, scaleMax: 500_000_000 })
    const a = operating.rows[0].segments[0].width
    // 2026 operating $452.7M next to 2026 capital total $286.2M: lengths are in the same ratio
    const capitalWidth = capital.rows[0].segments.reduce((sum, s) => sum + s.width + s.gap, 0)
    expect(a / capitalWidth).toBeCloseTo(452_723_152 / 286_193_208, 5)
    expect(operating.rows[0].segments[0].width).toBeCloseTo(
      operating.scale(452_723_152) - operating.scale(0),
      5,
    )
  })

  it('stretches the longest possible bar to the full plot width', () => {
    const { plotWidth, scale } = layout(FIXTURES.bars)
    expect(scale(500_000_000)).toBeCloseTo(plotWidth, 5)
    expect(plotWidth).toBeLessThan(VIEW_WIDTH)
  })

  it('leaves a 2px gap between stacked segments, and none before the first', () => {
    const [row] = layout(FIXTURES.borrowed).rows
    expect(SEGMENT_GAP).toBe(2)
    expect(row.segments[0].gap).toBe(0)
    expect(row.segments[1].gap).toBe(2)
    expect(row.segments[1].x).toBeCloseTo(row.segments[0].x + row.segments[0].width + 2, 5)
  })

  it('rounds only the data end: the last segment that has length', () => {
    const [first, second] = layout(FIXTURES.operating).rows
    expect(first.segments.map((s) => s.roundEnd)).toEqual([true, false])
    expect(second.segments.map((s) => s.roundEnd)).toEqual([false, true])
  })

  it('puts a segment’s label under it, and no labels when a row is one segment', () => {
    const [first, second] = layout(FIXTURES.operating).rows
    expect(first.labels).toEqual([])
    expect(second.labels.map((l) => l.text)).toEqual(['$452.7M', '+$24.8M'])
    expect(layout(FIXTURES.bars).rows.every((r) => r.labels.length === 0)).toBe(true)
  })

  it('keeps every label inside the drawing, even for a narrow last segment', () => {
    const { plotWidth, rows } = layout(FIXTURES.operating)
    const extra = rows[1].labels[1]
    expect(extra.anchor).toBe('end')
    expect(extra.x).toBeLessThanOrEqual(plotWidth)
  })

  it('has three recessive ticks: $0, half and the scale’s end', () => {
    expect(layout(FIXTURES.bars).ticks).toEqual([0, 250_000_000, 500_000_000])
  })

  it('grows taller for a row note', () => {
    const withNotes = layout(FIXTURES.borrowed)
    const { rowNotes: _unused, ...plain } = FIXTURES.borrowed
    expect(withNotes.height).toBeGreaterThan(layout(plain).height)
  })
})

const stackedOf = (values: number[][], extra: Record<string, unknown> = {}) => ({
  ...FIXTURES.borrowed,
  x: values[0].map((_, i) => `Row ${i}`),
  series: values.map((v, i) => ({ key: `s${i}`, label: `S${i}`, values: v })),
  rowNotes: undefined,
  scaleMax: 100,
  ...extra,
})

describe('segment gaps', () => {
  it('keeps a segment narrower than the gap visible, and still draws its mark', () => {
    const [row] = layout(stackedOf([[99.5], [0.5]])).rows
    expect(row.segments).toHaveLength(2)
    expect(row.segments[1].width).toBeGreaterThan(0)
    expect(row.segments[1].gap).toBeLessThan(SEGMENT_GAP)
  })

  it('puts no gap before the first visible segment, even after a zero one', () => {
    const [row] = layout(stackedOf([[0], [100]])).rows
    expect(row.segments[1].gap).toBe(0)
    expect(row.segments[1].x).toBe(0)
  })
})

describe('wrapText', () => {
  it('keeps short text on one line and breaks long text at spaces within the limit', () => {
    expect(wrapText('short note', 20)).toEqual(['short note'])
    const lines = wrapText(
      'Borrowing pays for $66 of every $100 in the 2027 proposed capital budget.',
      30,
    )
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.every((l) => l.length <= 30)).toBe(true)
    expect(lines.join(' ')).toBe(
      'Borrowing pays for $66 of every $100 in the 2027 proposed capital budget.',
    )
  })

  it('leaves a single word longer than the limit on its own line', () => {
    expect(wrapText('aaaaaaaaaaaa b', 5)).toEqual(['aaaaaaaaaaaa', 'b'])
  })
})

describe('long rows', () => {
  const NOTE = 'Borrowing pays for $66 of every $100 in the 2027 proposed capital budget.'
  it('wraps a long note and makes the row and the drawing taller for each extra line', () => {
    const short = layout(stackedOf([[10], [20]], { rowNotes: ['Short note'] }))
    const long = layout(stackedOf([[10], [20]], { rowNotes: [NOTE] }))
    expect(long.rows[0].noteLines.length).toBeGreaterThan(1)
    expect(long.rows[0].height).toBeGreaterThan(short.rows[0].height)
    expect(long.height).toBeGreaterThan(short.height)
  })

  it('wraps a row label too wide for the drawing, moves the bar down and keeps the total', () => {
    const label = 'A very long name for the year of the City budget that is proposed'
    const plain = layout(stackedOf([[10], [20]])).rows[0]
    const long = layout(stackedOf([[10], [20]], { x: [label] })).rows[0]
    expect(long.headLines.length).toBeGreaterThan(1)
    expect(long.headLines.map((l) => l.text).join(' ')).toBe(label)
    expect(long.headLines.at(-1)?.total).toBe('$30')
    expect(long.barY).toBeGreaterThan(plain.barY)
    expect(plain.headLines).toEqual([{ text: 'Row 0', total: '$30' }])
  })
})

describe('placeLabels', () => {
  const item = (x0: number, x1: number, text: string) => ({ x0, x1, text })

  it('starts a label at its segment and moves it to a second line instead of overlapping', () => {
    const placed = placeLabels([item(0, 30, '$100.0M'), item(32, 60, '$100.0M')], 300)
    expect(placed.map((p) => p.line)).toEqual([0, 1])
    expect(placed.map((p) => p.x)).toEqual([0, 32])
  })

  it('right-aligns a label that would run past the edge', () => {
    const [placed] = placeLabels([item(290, 300, '+$24.8M')], 300)
    expect(placed).toMatchObject({ anchor: 'end', x: 300 })
  })
})
