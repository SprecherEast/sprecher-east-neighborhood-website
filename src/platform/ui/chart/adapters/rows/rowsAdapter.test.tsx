// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { COMPACT_VISIBLE_ROWS } from '@/platform/lib/chart/chartLooks'
import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { CHART_PALETTE } from '@/platform/ui/chart/chartPalette'

import { describeChartAdapter } from '../../chartAdapter.contract'

import { rowsAdapter } from './rowsAdapter'

afterEach(cleanup)

const draw = (input: ChartSpec) =>
  render(
    <>
      {rowsAdapter.render(parseChartSpec(input), {
        titleId: 't',
        descId: 'd',
        palette: CHART_PALETTE,
      })}
    </>,
  )

describeChartAdapter(rowsAdapter, {
  markCount: (spec) => (spec.kind === 'bar' ? spec.data.length : 0),
})

const many = (count: number) => ({
  ...FIXTURES.operatingRows,
  data: Array.from({ length: count }, (_, i) => ({
    key: `k${i}`,
    label: `Area ${i}`,
    value: (count - i) * 1_000_000,
    previous: (count - i) * 1_000_000 - 100_000,
  })),
})

describe('rowsAdapter', () => {
  it('draws the compact look of bar charts only, as html', () => {
    expect(rowsAdapter.output).toBe('html')
    expect([...rowsAdapter.kinds]).toEqual(['bar'])
    expect(rowsAdapter.accepts?.(parseChartSpec(FIXTURES.operatingRows))).toBe(true)
    expect(rowsAdapter.accepts?.(parseChartSpec(FIXTURES.bars))).toBe(false)
    expect(rowsAdapter.enlargeable).toBe(false)
  })

  it('ranks the rows by amount and gives each its figure and signed change', () => {
    const { container } = draw(FIXTURES.operatingRows)
    const rows = [...container.querySelectorAll('[data-ranked-row]')]
    expect(rows.map((row) => row.querySelector('span')?.textContent)).toEqual([
      'Public safety',
      'Everything else and administration',
      'Debt service',
      'Public works',
      'Transportation',
    ])
    expect(rows[0].textContent).toContain('$194.8M')
    expect(rows[0].textContent).toContain('+$8.5M (+4.5%)')
    expect(rows[2].textContent).toContain('+$8.8M (+12.2%)')
  })

  it('draws every bar on one scale, the biggest full length', () => {
    const { container } = draw(FIXTURES.operatingRows)
    const widths = [...container.querySelectorAll('[data-chart-mark]')].map((bar) =>
      Number(bar.getAttribute('width')?.replace('%', '')),
    )
    expect(widths[0]).toBe(100)
    expect(widths[1]).toBeCloseTo((107_784_343 / 194_768_276) * 100, 1)
    expect(Math.min(...widths)).toBeCloseTo((37_858_292 / 194_768_276) * 100, 1)
  })

  it('says what the change is measured from, once', () => {
    const { container } = draw(FIXTURES.capitalRows)
    expect(container.textContent).toContain('Change from 2026 adopted')
  })

  it('leaves a row with no earlier amount without a change', () => {
    const { container } = draw({
      ...FIXTURES.capitalRows,
      data: [
        { key: 'a', label: 'A', value: 10, previous: 8 },
        { key: 'b', label: 'B', value: 5 },
      ],
    })
    expect(container.querySelectorAll('[data-signed-change]')).toHaveLength(1)
  })

  it('keeps the first rows in view and the smaller ones under "See the smaller pieces"', () => {
    const { container } = draw(many(COMPACT_VISIBLE_ROWS + 3))
    const details = container.querySelector('details')
    expect(details?.textContent).toContain('See the smaller pieces')
    expect(details?.querySelectorAll('[data-ranked-row]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-ranked-row]')).toHaveLength(COMPACT_VISIBLE_ROWS + 3)
  })

  it('has no "smaller pieces" box when everything fits', () => {
    const { container } = draw(many(COMPACT_VISIBLE_ROWS))
    expect(container.querySelector('details')).toBeNull()
  })

  it('refuses another kind', () => {
    expect(() =>
      rowsAdapter.render(parseChartSpec(FIXTURES.borrowed), {
        titleId: 't',
        descId: 'd',
        palette: CHART_PALETTE,
      }),
    ).toThrow(/does not draw stacked/)
  })
})
