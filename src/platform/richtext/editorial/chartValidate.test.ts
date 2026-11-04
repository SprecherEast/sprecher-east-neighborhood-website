import { describe, expect, it, vi } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'

import { fromChartSpec } from './chart'
import { checked, chartFieldError } from './chartValidate'

const block = (spec: Parameters<typeof fromChartSpec>[0], extra: Record<string, unknown> = {}) => ({
  ...fromChartSpec(spec),
  ...extra,
})

describe('chartFieldError', () => {
  it('has no complaint about any field of a valid chart', () => {
    for (const fixture of Object.values(FIXTURES)) {
      const stored = block(fixture)
      for (const field of [
        'title',
        'summary',
        'bars',
        'series',
        'rows',
        'groups',
        'scaleMax',
      ] as const) {
        expect(chartFieldError(field, stored)).toBe(true)
      }
    }
  })

  it('says where in the rows a negative value is, on the field that holds it', () => {
    const stored = block(FIXTURES.bars, {
      bars: [
        { label: 'A', value: 1 },
        { label: 'B', value: -2 },
      ],
    })
    // The bar's own number field already says it (`min: 0`), so the bars list adds nothing
    expect(chartFieldError('bars', stored)).toBe(true)
    expect(chartFieldError('title', stored)).toBe(true)
  })

  it('says a negative number in plain words, without the schema wording', () => {
    const stored = block(FIXTURES.borrowed, {
      rows: [{ label: 'A', values: [{ value: -2 }, { value: 1 }] }],
    })
    const said = chartFieldError('rows', stored)
    expect(said).toMatch(/can't be negative/)
    expect(said).not.toMatch(/Too small|expected number/)
  })

  it('shows an empty title or summary on its own field', () => {
    const stored = block(FIXTURES.bars, { title: ' ', summary: '' })
    expect(chartFieldError('title', stored)).not.toBe(true)
    expect(chartFieldError('summary', stored)).not.toBe(true)
  })

  it('says which bar and number is missing in stacked bars', () => {
    const stored = block(FIXTURES.borrowed, {
      rows: [{ label: '2026', values: [{ value: 1 }] }],
    })
    expect(chartFieldError('rows', stored)).toMatch(/Bar 1, number 2: enter a number/)
    expect(chartFieldError('series', stored)).toBe(true)
  })

  it('shows a row with too many numbers on the rows, saying which bar', () => {
    const stored = block(FIXTURES.borrowed, {
      rows: [{ label: '2026', values: [{ value: 1 }, { value: 2 }, { value: 3 }] }],
    })
    expect(chartFieldError('rows', stored)).toMatch(/Bar 1: .*3 numbers.*2 parts/)
  })

  it('asks for at least one row in words, on the field that holds the rows', () => {
    expect(chartFieldError('bars', block(FIXTURES.bars, { bars: [] }))).toBe('Add at least 1 row.')
    expect(chartFieldError('rows', block(FIXTURES.borrowed, { rows: [] }))).toBe(
      'Add at least 1 row.',
    )
    expect(chartFieldError('groups', block(FIXTURES.months, { groups: [] }))).toBe(
      'Add at least 1 row.',
    )
  })

  it('refuses a scale shorter than the longest bar on the scale field', () => {
    expect(chartFieldError('scaleMax', block(FIXTURES.bars, { scaleMax: 1 }))).toMatch(/scaleMax/)
  })

  it('refuses a group whose total is not its parts, on the groups', () => {
    const stored = block(FIXTURES.months, {
      groups: [{ label: 'Per month', total: 5, parts: [{ label: 'x', value: 90 }] }],
    })
    expect(chartFieldError('groups', stored)).toMatch(/Per month: the total 5/)
  })

  it('answers for the data as it is now, not as an earlier call saw it', () => {
    const stored = block(FIXTURES.bars, { title: ' ' })
    expect(chartFieldError('title', stored)).not.toBe(true)
    expect(chartFieldError('title', { ...stored, title: 'Fixed' })).toBe(true)
    expect(chartFieldError('title', stored)).not.toBe(true)
  })

  it('is silent until a kind is chosen', () => {
    expect(chartFieldError('title', {})).toBe(true)
  })

  it("leaves Payload's own check out of half-built form state, where an array is its count", async () => {
    const own = vi.fn(() => 'This field requires at least 1 Rows.' as const)
    const form = { kind: 'bar', title: 'T', summary: 'S', unit: 'usd', bars: 2, sources: 0 }
    expect(await checked('bars', own)(2 as never, { siblingData: form, event: 'onChange' })).toBe(
      true,
    )
    expect(own).not.toHaveBeenCalled()
    const rows = { ...form, bars: [{ label: 'A', value: 1 }], sources: [] }
    expect(await checked('bars', own)(rows.bars as never, { siblingData: rows })).toBe(own())
    // On the real save a count is no rows: Payload's own check and the chart rules both run
    expect(await checked('bars', own)(2 as never, { siblingData: form, event: 'submit' })).toBe(
      own(),
    )
  })

  describe('a row Admin has not had filled in yet', () => {
    const unfinished = block(FIXTURES.bars, { bars: [{ label: '2026', value: 452 }, { id: 'x' }] })

    it('has no opinion while the form is being built, so a stale reason is never shown', () => {
      expect(chartFieldError('bars', unfinished, 'onChange')).toBe(true)
      expect(
        chartFieldError(
          'bars',
          block(FIXTURES.bars, { bars: [{ id: 'x', label: ' ' }] }),
          'onChange',
        ),
      ).toBe(true)
    })

    it('is judged on the real save, in words an editor can use', () => {
      const said = chartFieldError('bars', unfinished, 'submit') as string
      expect(said).toMatch(/Bar 2: the label can't be empty; Bar 2: enter a number/)
      expect(said).not.toMatch(/Too small|expected/)
    })

    it('has no opinion on a list with no rows yet, which Admin would leave on screen', () => {
      expect(chartFieldError('bars', block(FIXTURES.bars, { bars: [] }), 'onChange')).toBe(true)
      expect(chartFieldError('bars', block(FIXTURES.bars, { bars: [] }), 'submit')).toBe(
        'Add at least 1 row.',
      )
    })

    it('still judges a finished chart as it is typed: a wrong total is shown live', () => {
      const wrong = block(FIXTURES.months, {
        groups: [{ label: 'A', total: 90, parts: [{ label: 'x', value: 5 }] }],
      })
      expect(chartFieldError('groups', wrong, 'onChange')).toMatch(/total 90/)
    })
  })

  it('names the group, not part NaN, when a group has no parts', () => {
    const stored = block(FIXTURES.months, { groups: [{ label: 'A', parts: [] }] })
    const said = chartFieldError('groups', stored, 'submit') as string
    expect(said).toBe('Group 1: Add at least 1 part.')
  })

  describe('with the data Admin builds while it fills in the form', () => {
    // Admin's form state gives an array field as its row count until the rows are built, and
    // a row with only its id before its fields are filled in (seen in a real Admin session)
    const FIELDS = [
      'title',
      'summary',
      'kind',
      'unit',
      'asOf',
      'certainty',
      'finePrint',
      'sources',
      'bars',
      'series',
      'rows',
      'groups',
      'scaleMax',
      'mode',
      'unitNote',
    ] as const
    const formStates: [string, Record<string, unknown>][] = [
      [
        'array fields as row counts',
        {
          kind: 'bar',
          title: 'T',
          summary: 'S',
          unit: 'usd',
          sources: 0,
          bars: 2,
          series: 0,
          rows: 0,
          groups: 0,
        },
      ],
      [
        'a row with only its id',
        { kind: 'bar', title: 'T', summary: 'S', unit: 'usd', sources: 0, bars: [{ id: 'a' }] },
      ],
      [
        'nested arrays as counts',
        {
          kind: 'stacked',
          title: 'T',
          summary: 'S',
          unit: 'usd',
          series: [{ id: 'a', label: 'A' }],
          rows: [{ id: 'r', label: '2026', values: 1 }],
        },
      ],
      [
        'parts as a count',
        {
          kind: 'units',
          mode: 'each',
          unitNote: 'n',
          title: 'T',
          summary: 'S',
          unit: 'usd',
          groups: [{ id: 'g', label: 'G', parts: 3 }],
        },
      ],
    ]
    it('still judges the chart when Admin gives an empty array as 0 (as it does when publishing)', () => {
      const publishing = {
        kind: 'stacked',
        title: 'T',
        summary: 'S',
        unit: 'usd',
        sources: 0,
        bars: 0,
        groups: 0,
        series: [{ label: 'A' }, { label: 'B' }],
        rows: [{ label: 'r', values: [{ value: 1 }] }],
      }
      expect(chartFieldError('rows', publishing)).toMatch(
        /Bar 1: has 1 number but there are 2 parts/,
      )
      expect(chartFieldError('title', publishing)).toBe(true)
    })

    it.each(formStates)('never throws, and has no opinion, for %s', (_name, data) => {
      for (const field of FIELDS) {
        expect(() => chartFieldError(field, data, 'onChange')).not.toThrow()
        expect(() => chartFieldError(field, data, 'submit')).not.toThrow()
      }
    })

    it.each(formStates.filter(([name]) => name !== 'a row with only its id'))(
      'does not say a count is a chart that is empty or wrong: %s',
      (_name, data) => {
        for (const field of FIELDS) expect(chartFieldError(field, data, 'onChange')).toBe(true)
      },
    )
  })
})
