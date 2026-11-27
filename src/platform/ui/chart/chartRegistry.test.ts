import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { CHART_KINDS, parseChartSpec } from '@/platform/lib/chart/spec'

import { textAdapter } from './adapters/text/textAdapter'
import { adapterFor } from './chartRegistry'

describe('adapterFor', () => {
  it('draws square grids and tiles as html, bars as svg, and anything else as text', () => {
    expect(adapterFor(parseChartSpec(FIXTURES.paysFor)).name).toBe('css')
    expect(adapterFor(parseChartSpec(FIXTURES.bars)).name).toBe('visx')
    expect(adapterFor(parseChartSpec(FIXTURES.borrowed)).name).toBe('visx')
    expect(adapterFor(parseChartSpec(FIXTURES.dayToDay)).name).toBe('breakdown')
  })

  it('draws the change-first look of stacked bars and the compact look of bars with their own adapters (#1503)', () => {
    expect(adapterFor(parseChartSpec(FIXTURES.operatingChange)).name).toBe('change')
    expect(adapterFor(parseChartSpec(FIXTURES.capitalRows)).name).toBe('rows')
  })

  it('keeps the usual drawing when no look is set', () => {
    const { look, ...plain } = FIXTURES.operatingChange
    expect(look).toBe('change')
    expect(adapterFor(parseChartSpec(plain)).name).toBe('visx')
    expect(adapterFor(parseChartSpec({ ...plain, look: 'bars' })).name).toBe('visx')
  })

  it('keeps the text adapter as the last resort for every kind', () => {
    for (const kind of CHART_KINDS) expect(textAdapter.kinds.has(kind)).toBe(true)
  })

  it('has an adapter for every fixture', () => {
    for (const fixture of Object.values(FIXTURES)) {
      const spec = parseChartSpec(fixture)
      expect(adapterFor(spec).kinds.has(spec.kind)).toBe(true)
    }
  })
})
