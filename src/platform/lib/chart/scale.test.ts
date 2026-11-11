import { describe, expect, it } from 'vitest'

import { toBreakdown } from './breakdown'
import { scaleBreakdown } from './scale'
import type { ChartSpec } from './spec'

type Breakdown = Extract<ChartSpec, { kind: 'breakdown' }>

const SPEC: Breakdown = {
  kind: 'breakdown',
  title: 'Where the City tax goes',
  summary: 'An estimate.',
  unit: 'usd',
  hideSquares: true,
  areas: [
    {
      key: 'safety',
      label: 'Public safety',
      value: 1400,
      pieces: [
        { key: 'police', label: 'Police', value: 740, shown: true },
        { key: 'fire', label: 'Fire', value: 590 },
      ],
    },
    { key: 'debt', label: 'Debt', value: 600 },
    { key: 'other', label: 'Everything else', value: 1000 },
  ],
}

const total = (spec: Breakdown) => spec.areas.reduce((sum, area) => sum + area.value, 0)

describe('scaleBreakdown', () => {
  it('scales every area and piece by the factor, so shares stay what they were', () => {
    const scaled = scaleBreakdown(SPEC, 0.5)
    expect(scaled.areas.map((a) => a.value)).toEqual([700, 300, 500])
    expect(scaled.areas[0]?.pieces?.map((p) => p.value)).toEqual([370, 295])
    const before = toBreakdown(SPEC).areas.map((a) => Math.round(a.share))
    const after = toBreakdown(scaled).areas.map((a) => Math.round(a.share))
    expect(after).toEqual(before)
  })

  it('rounds to whole dollars, so an estimate never shows false cents', () => {
    const scaled = scaleBreakdown(SPEC, 0.3333)
    expect(scaled.areas.every((a) => Number.isInteger(a.value))).toBe(true)
  })

  it('keeps cents while the whole is small, so no part rounds away to nothing', () => {
    const scaled = scaleBreakdown(SPEC, 0.01)
    expect(total(scaled)).toBeGreaterThan(0)
    expect(scaled.areas.every((a) => a.value > 0)).toBe(true)
  })

  it('scales what one square stands for, so the grid keeps its squares', () => {
    const squares = { ...SPEC, hideSquares: false, squareValue: 100 }
    const scaled = scaleBreakdown(squares, 2)
    expect(scaled.squareValue).toBe(200)
    expect(toBreakdown(scaled).squareCount).toBe(toBreakdown(squares).squareCount)
  })

  it('leaves everything else as it was', () => {
    const scaled = scaleBreakdown(SPEC, 2)
    expect(scaled.title).toBe(SPEC.title)
    expect(scaled.areas.map((a) => a.key)).toEqual(['safety', 'debt', 'other'])
    expect(SPEC.areas[1]?.value).toBe(600)
  })
})
