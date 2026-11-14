// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AreaChart, dayLabel } from './AreaChart'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const DAYS = ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']
const pathPoints = (container: HTMLElement) => {
  const d = container.querySelector('path[fill="none"]')?.getAttribute('d') ?? ''
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  return Array.from({ length: numbers.length / 2 }, (_, i) => [numbers[2 * i], numbers[2 * i + 1]])
}
const marker = (container: HTMLElement) => {
  const dot = container.querySelector('[data-testid="area-chart-marker"]')
  return [Number(dot?.getAttribute('x1')), Number(dot?.getAttribute('y1'))]
}

describe('dayLabel', () => {
  it('reads a day as text, so no time zone moves it', () => {
    expect(dayLabel('2026-10-31')).toBe('Oct 31')
    expect(dayLabel('2026-11-07')).toBe('Nov 7')
  })
})

describe('AreaChart', () => {
  it('is a named image that lists every value', () => {
    render(
      <AreaChart
        values={[0, 2, 5, 1, 3]}
        days={DAYS}
        label="Finished per day: 0, 2, 5, 1, 3"
        tone="done"
      />,
    )
    expect(screen.getByRole('img', { name: 'Finished per day: 0, 2, 5, 1, 3' })).toBeTruthy()
  })

  it('shows the first day, the middle day and Today under the curve', () => {
    render(<AreaChart values={[1, 2, 3, 4, 5]} days={DAYS} label="Sample" tone="done" />)
    expect(screen.getByText('Oct 31')).toBeTruthy()
    expect(screen.getByText('Nov 2')).toBeTruthy()
    expect(screen.getByText('Today')).toBeTruthy()
  })

  it('puts the marker on the last value, higher values higher up', () => {
    const { container } = render(
      <AreaChart values={[0, 2, 4, 3, 4]} days={DAYS} label="Sample" tone="done" />,
    )
    const points = pathPoints(container)
    const lastPoint = points[points.length - 1]
    expect(marker(container)).toEqual(lastPoint)
    expect(points[0][1]).toBeGreaterThan(points[points.length - 1][1])
  })

  it('puts the same value at the same height whatever the series, so tiles can share a scale', () => {
    const one = render(
      <AreaChart
        values={[0, 3]}
        days={['2026-11-03', '2026-11-04']}
        max={6}
        label="One"
        tone="done"
      />,
    )
    const other = render(
      <AreaChart
        values={[3, 0]}
        days={['2026-11-03', '2026-11-04']}
        max={6}
        label="Other"
        tone="done"
      />,
    )
    expect(pathPoints(one.container).at(-1)?.[1]).toBe(pathPoints(other.container)[0][1])
  })

  it('keeps a value above the maximum inside the picture', () => {
    const { container } = render(
      <AreaChart
        values={[0, 9]}
        days={['2026-11-03', '2026-11-04']}
        max={4}
        label="Over"
        tone="done"
      />,
    )
    expect(marker(container)[1]).toBeGreaterThanOrEqual(0)
  })

  it('starts a running total at its lowest value so its shape shows, and a count at zero', () => {
    const total = render(
      <AreaChart
        values={[100, 110]}
        days={['2026-11-03', '2026-11-04']}
        label="Total"
        tone="done"
        fromZero={false}
      />,
    )
    const count = render(
      <AreaChart
        values={[100, 110]}
        days={['2026-11-03', '2026-11-04']}
        label="Count"
        tone="done"
      />,
    )
    expect(pathPoints(total.container)[0][1]).toBeGreaterThan(pathPoints(count.container)[0][1])
  })

  it('draws a flat line along the baseline for all zeros and for a max of 0', () => {
    const { container } = render(
      <AreaChart
        values={[0, 0, 0]}
        days={['2026-11-02', '2026-11-03', '2026-11-04']}
        max={0}
        label="None"
        tone="open"
      />,
    )
    const ys = new Set(pathPoints(container).map(([, y]) => y))
    expect(ys.size).toBe(1)
  })

  it('draws a dot for one value and nothing for none', () => {
    const one = render(
      <AreaChart values={[4]} days={['2026-11-04']} max={8} label="One" tone="done" />,
    )
    expect(one.container.querySelector('path[fill="none"]')).toBeNull()
    expect(one.container.querySelector('[data-testid="area-chart-marker"]')).toBeTruthy()
    const none = render(<AreaChart values={[]} days={[]} label="Nothing" tone="done" />)
    expect(none.container.querySelector('[data-testid="area-chart-marker"]')).toBeNull()
  })

  it('uses theme tokens only: a class for each tone and no inline colour', () => {
    const { container } = render(
      <AreaChart values={[1, 2]} days={['2026-11-03', '2026-11-04']} label="Open" tone="open" />,
    )
    expect(container.querySelector('.stroke-success')).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|style=/i)
  })

  it('passes the accessibility check', async () => {
    const { container } = render(
      <AreaChart
        values={[0, 2, 5, 1, 3]}
        days={DAYS}
        label="Finished per day: 0, 2, 5, 1, 3"
        tone="done"
      />,
    )
    await expectAccessible(container)
  })
})
