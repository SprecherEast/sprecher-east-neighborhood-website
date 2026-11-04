import { describe, expect, it } from 'vitest'

import { toChartSpec } from './chart'

/** The block as stored: the fields the editor fills in, with empty ones as null (Payload's way). */
const stored = (extra: Record<string, unknown>) =>
  ({
    blockType: 'chart',
    title: 'Where the money goes',
    summary: 'Most of it pays for people.',
    unit: 'usd',
    asOf: null,
    certainty: null,
    finePrint: null,
    sources: [],
    ...extra,
  }) as Parameters<typeof toChartSpec>[0]

describe("the keys made for a chart's parts", () => {
  it('makes a key from accents and symbols the way the site makes any slug', () => {
    const spec = toChartSpec(
      stored({
        kind: 'bar',
        bars: [
          { label: 'Café & the "Big" Plan', value: 1 },
          { label: '???', value: 2 },
        ],
      }),
    )
    expect(spec.kind === 'bar' && spec.data.map((d) => d.key)).toEqual([
      'cafe-the-big-plan',
      'part',
    ])
  })

  it('keeps a made key within the spec limit when a repeat gets its -2 suffix', () => {
    const long = 'a'.repeat(60)
    const spec = toChartSpec(
      stored({
        kind: 'bar',
        bars: [
          { label: long, value: 1 },
          { label: long, value: 2 },
        ],
      }),
    )
    const keys = spec.kind === 'bar' ? spec.data.map((d) => d.key) : []
    expect(keys.every((key) => key.length <= 40)).toBe(true)
    expect(new Set(keys).size).toBe(2)
    expect(keys[1]).toMatch(/-2$/)
  })

  it('gives a made key a suffix that also clears a key typed later', () => {
    const spec = toChartSpec(
      stored({
        kind: 'bar',
        bars: [
          { label: 'Fire', value: 1 },
          { key: 'fire', label: 'Other', value: 2 },
        ],
      }),
    )
    expect(spec.kind === 'bar' && spec.data.map((d) => d.key)).toEqual(['fire-2', 'fire'])
  })

  it('keeps a key the editor or an agent gave, and makes repeated labels unique', () => {
    const spec = toChartSpec(
      stored({
        kind: 'bar',
        bars: [
          { key: 'mine', label: 'A', value: 1 },
          { label: 'Same', value: 2 },
          { label: 'Same', value: 3 },
        ],
      }),
    )
    expect(spec.kind === 'bar' && spec.data.map((d) => d.key)).toEqual(['mine', 'same', 'same-2'])
  })
})
