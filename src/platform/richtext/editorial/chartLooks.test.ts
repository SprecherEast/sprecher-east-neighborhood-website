import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { fromChartSpec, toChartSpec } from './chart'

describe('the compact looks of a block (#1503)', () => {
  it('stores the change look of a stacked chart and reads it back', () => {
    const spec = parseChartSpec(FIXTURES.capitalChange)
    const stored = fromChartSpec(spec)
    expect(stored.look).toBe('change')
    expect(toChartSpec(stored)).toEqual(spec)
  })

  it('leaves the look out when an editor never chose one, so the usual bars draw', () => {
    const stored = fromChartSpec(parseChartSpec(FIXTURES.operating))
    expect(toChartSpec({ ...stored, look: null })).not.toHaveProperty('look')
  })

  it('stores compact rows with each bar’s earlier amount and what it is', () => {
    const spec = parseChartSpec(FIXTURES.operatingRows)
    const stored = fromChartSpec(spec)
    expect(stored.density).toBe('compact')
    expect(stored.previousLabel).toBe('2026 adopted')
    expect(stored.bars?.[0].previous).toBe(186_307_712)
    expect(toChartSpec(stored)).toEqual(spec)
  })

  it('refuses an earlier amount without a name for it, on the field that needs it', () => {
    const stored = fromChartSpec(parseChartSpec(FIXTURES.capitalRows))
    expect(() => toChartSpec({ ...stored, previousLabel: '' })).toThrow(/earlier numbers/)
  })

  it('refuses the change look for three bars', () => {
    const stored = fromChartSpec(parseChartSpec(FIXTURES.capitalChange))
    const rows = [...(stored.rows ?? []), { label: 'Third', values: [{ value: 1 }, { value: 1 }] }]
    expect(() => toChartSpec({ ...stored, rows })).toThrow(/two rows/)
  })
})
