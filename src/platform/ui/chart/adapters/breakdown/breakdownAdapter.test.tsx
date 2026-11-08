// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { toBreakdown } from '@/platform/lib/chart/breakdown'
import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { CHART_PALETTE } from '@/platform/ui/chart/chartPalette'

import { describeChartAdapter } from '../../chartAdapter.contract'

import { breakdownAdapter } from './breakdownAdapter'

afterEach(cleanup)

const IDS = { titleId: 't', descId: 'd', palette: CHART_PALETTE }
const draw = (input: ChartSpec) =>
  render(<>{breakdownAdapter.render(parseChartSpec(input), IDS)}</>)
const modelOf = (input: ChartSpec) => {
  const spec = parseChartSpec(input)
  if (spec.kind !== 'breakdown') throw new Error('not a breakdown')
  return toBreakdown(spec)
}

describeChartAdapter(breakdownAdapter, {
  markCount: (spec) => {
    if (spec.kind !== 'breakdown') return 0
    const { squareCount, areas, smaller } = toBreakdown(spec)
    return (
      squareCount + areas.length + areas.reduce((n, a) => n + a.shown.length, 0) + smaller.length
    )
  },
})

describe('breakdownAdapter', () => {
  it('draws breakdowns only, as html, at full width with its own key', () => {
    expect(breakdownAdapter.output).toBe('html')
    expect([...breakdownAdapter.kinds]).toEqual(['breakdown'])
    expect(breakdownAdapter.enlargeable).toBe(false)
    expect(breakdownAdapter.usesColour).toBe(false)
  })

  it('names only the grid as an img: the bars and key stay real text', () => {
    const { container } = draw(FIXTURES.dayToDay)
    const images = container.querySelectorAll('[role="img"]')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('aria-labelledby')).toBe('t d')
    expect(images[0].querySelectorAll('[data-chart-mark]')).toHaveLength(96)
  })

  it('fills the grid area by area, in the ramp colour of each rank', () => {
    const { container } = draw(FIXTURES.dayToDay)
    const grid = container.querySelector('[role="img"]') as HTMLElement
    const { areas } = modelOf(FIXTURES.dayToDay)
    for (const area of areas) {
      const squares = grid.querySelectorAll(`[data-chart-mark="${area.key}"]`)
      expect(squares).toHaveLength(area.squares)
      for (const square of squares) {
        expect(square.className).toContain(`bg-chart-ramp-${area.step}`)
        expect(square.className).toContain('ramp-edge')
      }
    }
  })

  it('explains what a square is worth, in dollars', () => {
    const { container } = draw(FIXTURES.dayToDay)
    expect(container.textContent).toContain('= $5 million each. Rounded to whole squares.')
  })

  it('lists the areas with dollars and no mention of squares in the key', () => {
    const { getByRole } = draw(FIXTURES.dayToDay)
    const key = getByRole('list', { name: 'Where the money goes' })
    expect(key.textContent).toContain('Public safety & health')
    expect(key.textContent).toContain('$195M')
    expect(key.textContent?.toLowerCase()).not.toContain('square')
  })

  it('ranks the bars biggest first with dollars and percent, and the shown pieces beneath', () => {
    const { container } = draw(FIXTURES.dayToDay)
    const rows = [...container.querySelectorAll('[data-breakdown-row]')]
    const labels = rows.map((row) => row.querySelector('[data-label]')?.textContent)
    expect(labels.slice(0, 4)).toEqual([
      'Public safety & health',
      'Police',
      'Fire / EMS',
      'Debt service',
    ])
    expect(rows[0].textContent).toContain('$195M')
    expect(rows[0].textContent).toContain('40.8%')
  })

  it('draws each bar as a rect as long as its share times the shared scale', () => {
    const { container } = draw(FIXTURES.dayToDay)
    const bar = container.querySelector('[data-breakdown-row] [data-chart-mark="safety"]')
    expect(bar?.getAttribute('width')).toBe(
      `${((194_768_276 / 477_549_854) * 100 * 2.2).toFixed(2)}%`,
    )
  })

  it('colours a shown piece with its area, and nests it', () => {
    const { container } = draw(FIXTURES.dayToDay)
    const police = container.querySelector('[data-breakdown-row="police"]') as HTMLElement
    expect(police.className).toContain('border-chart-ramp-1/55')
    expect(police.querySelector('[data-chart-mark="police"]')?.getAttribute('class')).toContain(
      'fill-chart-ramp-1',
    )
  })

  it('folds the other pieces into "See the smaller pieces", biggest first, each in its area', () => {
    const { container } = draw(FIXTURES.dayToDay)
    const details = container.querySelector('details') as HTMLElement
    expect(details.querySelector('summary')?.textContent).toBe('See the smaller pieces')
    const rows = [...details.querySelectorAll('[data-breakdown-row]')]
    expect(rows[0].textContent).toContain('Planning & development')
    expect(rows[0].textContent).toContain('in Everything else')
    const amounts = rows.map((row) => row.querySelector('[data-amount]')?.textContent)
    expect(amounts[0]).toBe('$31.5M')
    // The smaller list is coloured by its own rank: first dark, last pale gray
    expect(rows[0].querySelector('[data-chart-mark]')?.getAttribute('class')).toContain(
      'fill-chart-ramp-1',
    )
    expect(rows.at(-1)?.querySelector('[data-chart-mark]')?.getAttribute('class')).toContain(
      'fill-chart-ramp-7',
    )
  })

  it('has no smaller-pieces box when there is nothing to fold', () => {
    const { container } = draw({
      ...FIXTURES.dayToDay,
      areas: [
        { key: 'a', label: 'A', value: 40_000_000 },
        { key: 'b', label: 'B', value: 30_000_000 },
        { key: 'c', label: 'C', value: 20_000_000 },
      ],
    } as ChartSpec)
    expect(container.querySelector('details')).toBeNull()
  })
})
