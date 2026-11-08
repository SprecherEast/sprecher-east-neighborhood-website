import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'

import { parseChartSpec } from './spec'
import { toChartPoints, toChartSummary, toChartTable, toScaleNote } from './table'

describe('toChartTable', () => {
  it('lists every part of a perHundred grid with its squares and its dollars', () => {
    const table = toChartTable(parseChartSpec(FIXTURES.paysFor))
    expect(table.head).toEqual(['Group', 'Part', 'Squares out of 100', 'Amount (US dollars)'])
    expect(table.rows).toHaveLength(12)
    expect(table.rowHeaders).toBe(2)
    expect(table.rows[0]).toEqual(['2026 adopted', 'Police, fire and health', '41', '$186,307,712'])
    expect(table.rows[6]).toEqual([
      '2027 proposed',
      'Police, fire and health',
      '41',
      '$194,768,276',
    ])
  })

  it('drops the group column when there is one group, and lists tiles without squares', () => {
    const table = toChartTable(parseChartSpec(FIXTURES.months))
    expect(table.head).toEqual(['Item', 'Amount (US dollars)'])
    expect(table.rows).toHaveLength(12)
    expect(table.rows[0]).toEqual(['January', '$7.50'])
    expect(table.rowHeaders).toBe(1)
  })

  it('gives a stacked chart a column per series, a total and the row notes', () => {
    const table = toChartTable(parseChartSpec(FIXTURES.borrowed))
    expect(table.head).toEqual(['Item', 'Borrowed', 'Other sources', 'Total', 'Note'])
    expect(table.rows[1]).toEqual([
      '2027 proposed',
      '$179,789,647',
      '$92,417,816',
      '$272,207,463',
      '$66 of every $100 is borrowed',
    ])
  })

  it('gives a bar chart one row per bar', () => {
    const table = toChartTable(parseChartSpec(FIXTURES.bars))
    expect(table.head).toEqual(['Item', 'Amount (US dollars)'])
    expect(table.rows.map((row) => row[0])).toEqual(['2026 adopted', '2027 proposed'])
  })
})

describe('toChartPoints', () => {
  it('has one point per datum, with its group', () => {
    const points = toChartPoints(parseChartSpec(FIXTURES.paysFor))
    expect(points).toHaveLength(12)
    expect(points[0]).toMatchObject({ group: '2026 adopted', label: 'Police, fire and health' })
  })
})

describe('toChartSummary', () => {
  it('names the squares each part gets, per group', () => {
    const text = toChartSummary(parseChartSpec(FIXTURES.paysFor))
    expect(text).toContain('Police, fire and health 41 of every $100')
    expect(text).toContain('2026 adopted')
    expect(text).toContain('2027 proposed')
  })

  it.each(Object.entries(FIXTURES))('is a few whole sentences for %s', (_name, fixture) => {
    const text = toChartSummary(parseChartSpec(fixture))
    expect(text.length).toBeGreaterThan(20)
    expect(text.endsWith('.')).toBe(true)
  })
})

describe('toScaleNote', () => {
  it('states each grid’s own dollars per square, and that equal squares are not equal dollars', () => {
    const note = toScaleNote(parseChartSpec(FIXTURES.paysFor))
    expect(note).toContain('about $4.5M in 2026 adopted')
    expect(note).toContain('$4.8M in 2027 proposed')
    expect(note).toMatch(/equal (numbers of )?squares/i)
    expect(note).not.toMatch(/\$4\.8M\)/)
  })

  it('names one scale for one grid, and nothing for tiles or other kinds', () => {
    expect(toScaleNote(parseChartSpec(FIXTURES.comesIn))).toContain('about $4.8M')
    expect(toScaleNote(parseChartSpec(FIXTURES.comesIn))).not.toMatch(/equal/i)
    expect(toScaleNote(parseChartSpec(FIXTURES.months))).toBeNull()
    expect(toScaleNote(parseChartSpec(FIXTURES.bars))).toBeNull()
  })

  it('derives the figure from the data, not from typed text', () => {
    const spec = structuredClone(FIXTURES.comesIn)
    spec.groups[0].total = 1_000_000_000
    spec.groups[0].data = [{ key: 'a', label: 'A', value: 1_000_000_000 }]
    expect(toScaleNote(parseChartSpec(spec))).toContain('about $10M')
  })
})

describe('a breakdown chart', () => {
  const spec = parseChartSpec(FIXTURES.dayToDay)

  it('lists every area, then its pieces, with squares for the areas and shares for all', () => {
    const table = toChartTable(spec)
    expect(table.head).toEqual([
      'Area',
      'Piece',
      'Squares',
      'Amount (US dollars)',
      'Share (percent)',
    ])
    expect(table.rowHeaders).toBe(2)
    expect(table.rows[0]).toEqual([
      'Public safety & health',
      'Whole area',
      '39',
      '$194,768,276',
      '40.8%',
    ])
    expect(table.rows[1]).toEqual(['Public safety & health', 'Police', '', '$102,492,663', '21.5%'])
    const names = table.rows.map((row) => row[1])
    expect(names).toContain('General government')
  })

  it('has one point per area and per piece, the pieces under their area', () => {
    const points = toChartPoints(spec)
    expect(points[0]).toMatchObject({ group: null, label: 'Public safety & health' })
    expect(points).toContainEqual(
      expect.objectContaining({ group: 'Public safety & health', label: 'Police' }),
    )
  })

  it('describes the grid and the areas in whole sentences', () => {
    const summary = toChartSummary(spec)
    expect(summary).toMatch(/^A grid of 96 squares, \$5M each/)
    expect(summary).toContain('Public safety & health $194.8M')
  })

  it('has no scale note: the grid draws its own key', () => {
    expect(toScaleNote(spec)).toBeNull()
  })
})
