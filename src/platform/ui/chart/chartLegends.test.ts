import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec } from '@/platform/lib/chart/spec'

import { toChartLegends } from './chartLegends'
import { CHART_PALETTE } from './chartPalette'

const legends = (fixture: Parameters<typeof parseChartSpec>[0]) =>
  toChartLegends(parseChartSpec(fixture), CHART_PALETTE)

describe('toChartLegends', () => {
  it('gives one grid its squares and short dollars per part', () => {
    const [key] = legends(FIXTURES.comesIn)
    expect(key.items[0]).toMatchObject({ label: 'Property tax (the levy)', slot: 1 })
    expect(key.items[0].text).toBe('71 of every $100, $337.9M')
    expect(key.items.map((i) => i.slot)).toEqual([1, 2, 3, 4])
  })

  it('gives two grids with different parts a key each', () => {
    const spec = structuredClone(FIXTURES.paysFor)
    spec.groups[1].data = FIXTURES.comesIn.groups[0].data
    const keys = legends(spec)
    expect(keys.map((k) => k.label)).toEqual([
      'Chart key: 2026 adopted',
      'Chart key: 2027 proposed',
    ])
  })

  it('has no key for single-colour tiles, and a key per group when tiles differ by group', () => {
    expect(legends(FIXTURES.months)).toEqual([])
    const spec = structuredClone(FIXTURES.months)
    spec.groups.push({ ...spec.groups[0], key: 'other', label: 'Other year' })
    expect(legends(spec)[0].items.map((i) => i.slot)).toEqual([1, 2])
  })

  it('names each series of a stacked chart, with its hatch', () => {
    const [key] = legends(FIXTURES.borrowed)
    expect(key.items).toEqual([
      { label: 'Borrowed', text: null, slot: 1 },
      { label: 'Other sources', text: null, slot: 2, pattern: 'hatch' },
    ])
  })

  it('shares one key only when every part matches in key, label and pattern', () => {
    const relabelled = structuredClone(FIXTURES.paysFor)
    relabelled.groups[1].data[0].label = 'Police and fire'
    expect(legends(relabelled).map((k) => k.label)).toEqual([
      'Chart key: 2026 adopted',
      'Chart key: 2027 proposed',
    ])

    const hatched = structuredClone(FIXTURES.paysFor)
    Object.assign(hatched.groups[1].data[1], { pattern: 'hatch' })
    const keys = legends(hatched)
    expect(keys).toHaveLength(2)
    expect(keys[1].items[1].pattern).toBe('hatch')
    expect(keys[0].items[1].pattern).toBeUndefined()

    expect(legends(FIXTURES.paysFor)).toHaveLength(1)
  })
})
