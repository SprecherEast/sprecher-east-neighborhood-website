import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { fromChartSpec, toChartSpec } from './chart'

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

describe('toChartSpec', () => {
  it('maps a bar block: rows to data, with keys made from the labels', () => {
    const spec = toChartSpec(
      stored({
        kind: 'bar',
        scaleMax: 100,
        bars: [
          { label: 'Fire', value: 40, hatch: false },
          { label: 'Police dept.', value: 60, hatch: true, key: null },
        ],
        sources: [{ linkLabel: 'City budget', linkUrl: 'https://example.com/b' }],
        asOf: 'October 2026',
        certainty: 'estimate',
      }),
    )
    expect(spec).toEqual({
      kind: 'bar',
      orientation: 'horizontal',
      title: 'Where the money goes',
      summary: 'Most of it pays for people.',
      unit: 'usd',
      asOf: 'October 2026',
      certainty: 'estimate',
      sources: [{ label: 'City budget', href: 'https://example.com/b' }],
      scaleMax: 100,
      data: [
        { key: 'fire', label: 'Fire', value: 40 },
        { key: 'police-dept', label: 'Police dept.', value: 60, pattern: 'hatch' },
      ],
    })
  })

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
          { key: 'b'.repeat(40), label: 'x', value: 1 },
          { key: 'b'.repeat(40), label: 'y', value: 1 },
        ],
      }),
    )
    const keys = spec.kind === 'bar' ? spec.data.map((d) => d.key) : []
    expect(keys.every((key) => key.length <= 40)).toBe(true)
    expect(new Set(keys).size).toBe(4)
    expect(keys[1]).toMatch(/-2$/)
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

  it('maps a stacked block: rows and their values to x, series values and row notes', () => {
    const spec = toChartSpec(
      stored({
        kind: 'stacked',
        series: [
          { key: 'borrowed', label: 'Borrowed' },
          { label: 'Other', hatch: true, increase: true },
        ],
        rows: [
          { label: '2026', note: '$60 of $100', values: [{ value: 6 }, { value: 4 }] },
          { label: '2027', note: '$66 of $100', values: [{ value: 7 }, { value: 3 }] },
        ],
      }),
    )
    expect(spec).toMatchObject({
      kind: 'stacked',
      orientation: 'horizontal',
      x: ['2026', '2027'],
      rowNotes: ['$60 of $100', '$66 of $100'],
      series: [
        { key: 'borrowed', label: 'Borrowed', values: [6, 7] },
        { key: 'other', label: 'Other', values: [4, 3], pattern: 'hatch', increase: true },
      ],
    })
  })

  it('refuses a row with more or fewer numbers than there are parts, instead of cutting it', () => {
    const rows = (values: number[]) => [
      { label: '2026', values: values.map((value) => ({ value })) },
    ]
    for (const values of [[10, 90], []]) {
      expect(() =>
        toChartSpec(stored({ kind: 'stacked', series: [{ label: 'A' }], rows: rows(values) })),
      ).toThrow(/rows\.0\.values: .*1 part/)
    }
  })

  it('leaves out row notes when no row has one', () => {
    const spec = toChartSpec(
      stored({
        kind: 'stacked',
        series: [{ label: 'A' }],
        rows: [{ label: '2026', values: [{ value: 1 }] }],
      }),
    )
    expect(spec).not.toHaveProperty('rowNotes')
  })

  it('maps a units block: groups with their parts, and the mode and note', () => {
    const spec = toChartSpec(
      stored({
        kind: 'units',
        mode: 'perHundred',
        unitNote: 'One square is $1 of every $100.',
        groups: [
          {
            label: '2026',
            total: 100,
            parts: [
              { label: 'People', value: 60 },
              { label: 'Loans', value: 40, hatch: true },
            ],
          },
        ],
      }),
    )
    expect(spec).toMatchObject({
      kind: 'units',
      mode: 'perHundred',
      unitNote: 'One square is $1 of every $100.',
      groups: [
        {
          key: '2026',
          label: '2026',
          total: 100,
          data: [
            { key: 'people', label: 'People', value: 60 },
            { key: 'loans', label: 'Loans', value: 40, pattern: 'hatch' },
          ],
        },
      ],
    })
  })

  it('ignores the fields of the other kinds that an editor left behind', () => {
    const spec = toChartSpec(
      stored({
        kind: 'bar',
        bars: [{ label: 'A', value: 1 }],
        groups: [{ label: 'old', parts: [] }],
        mode: 'each',
        rows: [{ label: 'x', values: [] }],
      }),
    )
    expect(spec).not.toHaveProperty('groups')
    expect(spec).not.toHaveProperty('mode')
  })

  it.each([
    ['an empty title', { title: '  ' }, /title/i],
    ['an empty summary', { summary: '' }, /summary/i],
    ['a negative value', { bars: [{ label: 'A', value: -1 }] }, /value/i],
    ['no rows', { bars: [] }, /data|bars/i],
    ['a bar longer than the scale', { scaleMax: 5, bars: [{ label: 'A', value: 9 }] }, /scaleMax/],
  ])('refuses %s, with the reason', (_name, extra, reason) => {
    expect(() =>
      toChartSpec(stored({ kind: 'bar', bars: [{ label: 'A', value: 1 }], ...extra })),
    ).toThrow(reason)
  })

  it('refuses a group whose total is not its parts', () => {
    expect(() =>
      toChartSpec(
        stored({
          kind: 'units',
          mode: 'each',
          unitNote: 'One tile is one thing.',
          groups: [{ label: 'A', total: 90, parts: [{ label: 'x', value: 5 }] }],
        }),
      ),
    ).toThrow(/total/)
  })
})

describe('fromChartSpec', () => {
  it.each(Object.entries(FIXTURES))(
    'is the inverse of toChartSpec for the %s sample',
    (_n, fixture) => {
      const spec = parseChartSpec(fixture)
      expect(toChartSpec({ blockType: 'chart', ...fromChartSpec(spec) } as never)).toEqual(spec)
    },
  )

  it('stores a hatch as a checkbox and an increase as true', () => {
    const fields = fromChartSpec(parseChartSpec(FIXTURES.operating))
    expect(fields.series?.[1]).toMatchObject({ key: 'increase', hatch: true, increase: true })
  })
})
