import { describe, expect, it } from 'vitest'

import { CHART_KINDS } from '@/platform/lib/chart/spec'

import { adapterFor } from './chartRegistry'

describe('adapterFor', () => {
  it('draws square grids and tiles as html, and everything else as text', () => {
    expect(adapterFor('units').name).toBe('css')
    expect(adapterFor('bar').name).toBe('text')
    expect(adapterFor('stacked').name).toBe('text')
  })

  it('has an adapter for every kind', () => {
    for (const kind of CHART_KINDS) expect(adapterFor(kind).kinds.has(kind)).toBe(true)
  })
})
