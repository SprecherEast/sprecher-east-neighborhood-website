import { describe, expect, it } from 'vitest'

import { CHART_KINDS } from '@/platform/lib/chart/spec'

import { textAdapter } from './adapters/text/textAdapter'
import { adapterFor } from './chartRegistry'

describe('adapterFor', () => {
  it('draws square grids and tiles as html, bars as svg, and anything else as text', () => {
    expect(adapterFor('units').name).toBe('css')
    expect(adapterFor('bar').name).toBe('visx')
    expect(adapterFor('stacked').name).toBe('visx')
    expect(adapterFor('breakdown').name).toBe('breakdown')
  })

  it('keeps the text adapter as the last resort for every kind', () => {
    for (const kind of CHART_KINDS) expect(textAdapter.kinds.has(kind)).toBe(true)
  })

  it('has an adapter for every kind', () => {
    for (const kind of CHART_KINDS) expect(adapterFor(kind).kinds.has(kind)).toBe(true)
  })
})
