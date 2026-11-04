import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'

import { fromChartSpec } from './chart'
import { chartFieldError } from './chartValidate'

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
    expect(chartFieldError('bars', stored)).toMatch(/^Bar 2: .*>=0/)
    expect(chartFieldError('title', stored)).toBe(true)
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

  it('refuses a scale shorter than the longest bar on the scale field', () => {
    expect(chartFieldError('scaleMax', block(FIXTURES.bars, { scaleMax: 1 }))).toMatch(/scaleMax/)
  })

  it('refuses a group whose total is not its parts, on the groups', () => {
    const stored = block(FIXTURES.months, {
      groups: [{ label: 'Per month', total: 5, parts: [{ label: 'x', value: 90 }] }],
    })
    expect(chartFieldError('groups', stored)).toMatch(/Per month: the total 5/)
  })

  it('is silent until a kind is chosen', () => {
    expect(chartFieldError('title', {})).toBe(true)
  })
})
