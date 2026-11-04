// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { SQUARES_PER_HUNDRED, parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'
import { CHART_PALETTE } from '@/platform/ui/chart/chartPalette'

import { describeChartAdapter } from '../../chartAdapter.contract'

import { cssAdapter } from './cssAdapter'

afterEach(cleanup)

const IDS = { titleId: 't', descId: 'd', palette: CHART_PALETTE }
const draw = (spec: ChartSpec) => render(<>{cssAdapter.render(parseChartSpec(spec), IDS)}</>)

describeChartAdapter(cssAdapter, {
  markCount: (spec) =>
    spec.kind !== 'units'
      ? 0
      : spec.groups.reduce(
          (total, g) => total + (spec.mode === 'perHundred' ? SQUARES_PER_HUNDRED : g.data.length),
          0,
        ),
})

describe('cssAdapter', () => {
  it('draws only square grids and tiles, as html', () => {
    expect(cssAdapter.output).toBe('html')
    expect([...cssAdapter.kinds]).toEqual(['units'])
  })

  it('wraps the drawing in one img named by the title and description', () => {
    const { container } = draw(FIXTURES.paysFor)
    const images = container.querySelectorAll('[role="img"]')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('aria-labelledby')).toBe('t d')
  })

  it('fills each grid with exactly 100 squares in the 2027 shares: 41, 17, 12, 12, 10, 8', () => {
    const { container } = draw(FIXTURES.paysFor)
    const grid = container.querySelectorAll('.grid-cols-10')[1]
    const counts = ['safety', 'debt', 'works', 'planning', 'running', 'transport'].map(
      (key) => grid.querySelectorAll(`[data-chart-mark="${key}"]`).length,
    )
    expect(counts).toEqual([41, 17, 12, 12, 10, 8])
  })

  it('gives each part its own colour slot, in order, and never repeats one', () => {
    const { container } = draw(FIXTURES.comesIn)
    const slots = ['levy', 'fees', 'aid', 'savings'].map(
      (key) =>
        container.querySelector(`[data-chart-mark="${key}"]`)?.className.match(/bg-chart-\d/)?.[0],
    )
    expect(slots).toEqual(['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4'])
  })

  it('hatches a patterned part with the shared bg-hatch stripes', () => {
    const spec = structuredClone(FIXTURES.comesIn) as ChartSpec & { groups: { data: object[] }[] }
    Object.assign(spec.groups[0].data[3], { pattern: 'hatch' })
    const { container } = draw(spec)
    expect(container.querySelector('[data-chart-mark="savings"]')?.className).toContain('bg-hatch')
    expect(container.querySelector('[data-chart-mark="levy"]')?.className).not.toContain('bg-hatch')
  })

  it('prints each tile’s month and amount as text under the tile', () => {
    const { container } = draw(FIXTURES.months)
    expect(container.textContent).toContain('January')
    expect(container.textContent).toContain('$7.50')
    expect(container.querySelectorAll('[data-chart-mark]')).toHaveLength(12)
  })

  it('refuses a kind it does not draw', () => {
    expect(() => draw(FIXTURES.bars)).toThrow(/does not draw/)
  })
})
