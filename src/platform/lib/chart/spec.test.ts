import { describe, expect, it } from 'vitest'

import { parseChartSpec } from './spec'

const datum = (key: string, value: number) => ({ key, label: `Part ${key}`, value })
const base = { title: 'Title', summary: 'The takeaway.', unit: 'usd' as const }

const unitsSpec = (overrides: Record<string, unknown> = {}) => ({
  ...base,
  kind: 'units',
  mode: 'perHundred',
  unitNote: 'Each square is $1 of every $100.',
  groups: [{ key: 'g', label: '2027', total: 300, data: [datum('a', 100), datum('b', 200)] }],
  ...overrides,
})

describe('parseChartSpec', () => {
  it('accepts a units chart, a stacked chart and a bar chart', () => {
    expect(parseChartSpec(unitsSpec()).kind).toBe('units')
    expect(
      parseChartSpec({
        ...base,
        kind: 'stacked',
        orientation: 'horizontal',
        x: ['2026', '2027'],
        series: [
          { key: 'borrowed', label: 'Borrowed', values: [171.7, 179.8] },
          { key: 'other', label: 'Other', values: [114.5, 92.4], pattern: 'hatch' },
        ],
        rowNotes: ['$60 of every $100 borrowed', '$66 of every $100 borrowed'],
      }).kind,
    ).toBe('stacked')
    expect(
      parseChartSpec({ ...base, kind: 'bar', orientation: 'horizontal', data: [datum('a', 1)] })
        .kind,
    ).toBe('bar')
  })

  it('accepts the two palettes and refuses an unknown one', () => {
    expect(parseChartSpec(unitsSpec({ palette: 'warm' })).palette).toBe('warm')
    expect(parseChartSpec(unitsSpec({ palette: 'default' })).palette).toBe('default')
    expect(() => parseChartSpec(unitsSpec({ palette: 'neon' }))).toThrow()
  })

  it('refuses an unknown kind', () => {
    expect(() => parseChartSpec({ ...base, kind: 'pie' })).toThrow()
  })

  it('refuses a total more than $1 away from the sum', () => {
    const groups = [{ key: 'g', label: 'x', total: 302, data: [datum('a', 100), datum('b', 200)] }]
    expect(() => parseChartSpec(unitsSpec({ groups }))).toThrow(/total/i)
    groups[0].total = 300.9
    expect(() => parseChartSpec(unitsSpec({ groups }))).not.toThrow()
  })

  it('refuses more than 6 parts in a perHundred grid, so a colour never repeats', () => {
    const data = [1, 2, 3, 4, 5, 6, 7].map((n) => datum(String(n), n))
    expect(() => parseChartSpec(unitsSpec({ groups: [{ key: 'g', label: 'x', data }] }))).toThrow(
      /6/,
    )
  })

  it('allows 1 to 12 tiles in "each" mode and refuses 13', () => {
    const tiles = (count: number) => [
      { key: 'g', label: 'x', data: Array.from({ length: count }, (_, i) => datum(`m${i}`, 7.5)) },
    ]
    expect(() => parseChartSpec(unitsSpec({ mode: 'each', groups: tiles(12) }))).not.toThrow()
    expect(() => parseChartSpec(unitsSpec({ mode: 'each', groups: tiles(13) }))).toThrow()
    expect(() => parseChartSpec(unitsSpec({ mode: 'each', groups: tiles(0) }))).toThrow()
  })

  it('refuses a third group, a negative value, an all-zero grid and duplicate keys', () => {
    const group = { key: 'g', label: 'x', data: [datum('a', 1)] }
    expect(() => parseChartSpec(unitsSpec({ groups: [group, group, group] }))).toThrow()
    expect(() =>
      parseChartSpec(unitsSpec({ groups: [{ ...group, data: [datum('a', -1)] }] })),
    ).toThrow()
    expect(() =>
      parseChartSpec(unitsSpec({ groups: [{ ...group, data: [datum('a', 0)] }] })),
    ).toThrow()
    expect(() =>
      parseChartSpec(unitsSpec({ groups: [{ ...group, data: [datum('a', 1), datum('a', 2)] }] })),
    ).toThrow(/twice|duplicate|unique/i)
  })

  it('refuses a stacked series whose values do not match the rows', () => {
    expect(() =>
      parseChartSpec({
        ...base,
        kind: 'stacked',
        orientation: 'horizontal',
        x: ['2026', '2027'],
        series: [{ key: 's', label: 'S', values: [1] }],
      }),
    ).toThrow(/rows/i)
  })

  it('refuses a perHundred grid that is not in dollars, since it is a share of every $100', () => {
    for (const unit of ['count', 'percent', 'mills']) {
      expect(() => parseChartSpec(unitsSpec({ unit })), unit).toThrow(/dollars/i)
    }
    expect(() => parseChartSpec(unitsSpec({ mode: 'each', unit: 'count' }))).not.toThrow()
  })

  describe('scale and increases on bars (#663)', () => {
    const bars = (overrides: Record<string, unknown> = {}) => ({
      ...base,
      kind: 'bar',
      orientation: 'horizontal',
      data: [datum('a', 100), datum('b', 400)],
      ...overrides,
    })
    const stacked = (overrides: Record<string, unknown> = {}) => ({
      ...base,
      kind: 'stacked',
      orientation: 'horizontal',
      x: ['2026', '2027'],
      series: [
        { key: 'same', label: 'Same', values: [100, 100] },
        { key: 'more', label: 'More', values: [0, 20], pattern: 'hatch', increase: true },
      ],
      ...overrides,
    })

    it('accepts a scaleMax at least as long as the longest bar, and refuses a shorter one', () => {
      expect(() => parseChartSpec(bars({ scaleMax: 400 }))).not.toThrow()
      expect(() => parseChartSpec(bars({ scaleMax: 399 }))).toThrow(/scaleMax/)
      expect(() => parseChartSpec(stacked({ scaleMax: 120 }))).not.toThrow()
      expect(() => parseChartSpec(stacked({ scaleMax: 119 }))).toThrow(/scaleMax/)
    })

    it('does not refuse a scaleMax that equals the longest bar only up to float rounding', () => {
      const decimals = bars({ data: [datum('a', 0.1 + 0.2)], scaleMax: 0.3 })
      expect(() => parseChartSpec(decimals)).not.toThrow()
      const sums = stacked({
        series: [
          { key: 'a', label: 'A', values: [171.7, 1] },
          { key: 'b', label: 'B', values: [114.5, 1] },
        ],
        scaleMax: 286.2,
      })
      expect(() => parseChartSpec(sums)).not.toThrow()
      expect(() => parseChartSpec(bars({ data: [datum('a', 0.30001)], scaleMax: 0.3 }))).toThrow(
        /scaleMax/,
      )
    })

    it('accepts a series marked as an increase', () => {
      const spec = parseChartSpec(stacked())
      expect(spec.kind === 'stacked' && spec.series[1].increase).toBe(true)
    })
  })

  describe('source links', () => {
    const withHref = (href: string) =>
      parseChartSpec({
        ...base,
        kind: 'bar',
        orientation: 'horizontal',
        data: [datum('a', 1)],
        sources: [{ label: 'City budget', href }],
      })

    it('takes a site path or a full http or https address', () => {
      for (const href of ['/budget', 'https://example.com/b', 'http://example.com/b']) {
        expect(() => withHref(href)).not.toThrow()
      }
    })

    it('refuses anything a browser could run or send off the site', () => {
      for (const href of [
        'javascript:alert(1)',
        'data:text/html,x',
        '//evil.example',
        '/\\evil.example',
        'mailto:a@b.c',
        'budget',
      ]) {
        expect(() => withHref(href), href).toThrow(/site path/)
      }
    })
  })
})

const piece = (key: string, value: number, shown?: true) => ({
  key,
  label: `Piece ${key}`,
  value,
  ...(shown && { shown }),
})
const area = (key: string, value: number, pieces?: ReturnType<typeof piece>[]) => ({
  key,
  label: `Area ${key}`,
  value,
  ...(pieces && { pieces }),
})
const breakdownSpec = (overrides: Record<string, unknown> = {}) => ({
  ...base,
  kind: 'breakdown',
  squareValue: 5_000_000,
  areas: [
    area('a', 60_000_000, [piece('a1', 40_000_000, true), piece('a2', 10_000_000)]),
    area('b', 40_000_000),
  ],
  ...overrides,
})

describe('parseChartSpec: breakdown', () => {
  it('accepts areas with pieces, and a piece shown under its area', () => {
    const spec = parseChartSpec(breakdownSpec())
    expect(spec.kind).toBe('breakdown')
  })

  it('needs dollars, because a square stands for a dollar amount', () => {
    expect(() => parseChartSpec(breakdownSpec({ unit: 'percent' }))).toThrow(/dollars/i)
  })

  it('refuses a square that is not a positive amount', () => {
    expect(() => parseChartSpec(breakdownSpec({ squareValue: 0 }))).toThrow()
    expect(() => parseChartSpec(breakdownSpec({ squareValue: -5 }))).toThrow()
  })

  it('refuses more than 7 areas: the colour ramp has 7 steps', () => {
    const areas = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => area(String(n), n * 1_000_000))
    expect(() => parseChartSpec(breakdownSpec({ areas }))).toThrow(/7/)
  })

  it('refuses an area of zero dollars: it could not be drawn', () => {
    expect(() => parseChartSpec(breakdownSpec({ areas: [area('a', 0), area('b', 1)] }))).toThrow()
  })

  it('refuses pieces that add up to more than their area', () => {
    const areas = [area('a', 10_000_000, [piece('a1', 8_000_000), piece('a2', 8_000_000)])]
    expect(() => parseChartSpec(breakdownSpec({ areas }))).toThrow(/Area a/)
  })

  it('refuses a key used twice, in areas or pieces', () => {
    expect(() =>
      parseChartSpec(breakdownSpec({ areas: [area('a', 5_000_000), area('a', 5_000_000)] })),
    ).toThrow(/used twice/)
    expect(() =>
      parseChartSpec(
        breakdownSpec({
          areas: [
            area('a', 9_000_000, [piece('x', 1_000_000)]),
            area('b', 9_000_000, [piece('x', 1_000_000)]),
          ],
        }),
      ),
    ).toThrow(/used twice/)
  })

  it('refuses a square so small that the grid would need more than 200 squares', () => {
    expect(() => parseChartSpec(breakdownSpec({ squareValue: 100_000 }))).toThrow(/200/)
  })

  it('refuses a square so big that the areas could not each get one', () => {
    expect(() => parseChartSpec(breakdownSpec({ squareValue: 100_000_000 }))).toThrow(/square/i)
  })
})
