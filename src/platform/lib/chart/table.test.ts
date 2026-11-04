import { describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'

import { parseChartSpec } from './spec'
import { toChartPoints, toChartSummary, toChartTable } from './table'

describe('toChartTable', () => {
  it('lists every part of a perHundred grid with its squares and its dollars', () => {
    const table = toChartTable(parseChartSpec(FIXTURES.paysFor))
    expect(table.head).toEqual(['Group', 'Part', 'Squares out of 100', 'Amount (US dollars)'])
    expect(table.rows).toHaveLength(12)
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
