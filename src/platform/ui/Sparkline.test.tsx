// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Sparkline } from './Sparkline'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const points = (container: HTMLElement) =>
  (container.querySelector('polyline')?.getAttribute('points') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((pair) => pair.split(',').map(Number) as [number, number])

describe('Sparkline', () => {
  it('is a named image that lists every value', () => {
    render(<Sparkline values={[0, 2, 5]} max={5} label="Finished per week: 0, 2, 5" />)
    expect(screen.getByRole('img', { name: 'Finished per week: 0, 2, 5' })).toBeTruthy()
  })

  it('draws one point per value, left to right, higher values higher up', () => {
    const { container } = render(<Sparkline values={[0, 2, 4]} max={4} label="Sample" />)
    const [a, b, c] = points(container)
    expect(a[0]).toBeLessThan(b[0])
    expect(b[0]).toBeLessThan(c[0])
    expect(a[1]).toBeGreaterThan(b[1])
    expect(b[1]).toBeGreaterThan(c[1])
  })

  it('puts the same value at the same height whatever the series, so tiles can share a scale', () => {
    const one = render(<Sparkline values={[1, 3]} max={6} label="One" />)
    const other = render(<Sparkline values={[3, 0]} max={6} label="Other" />)
    expect(points(one.container)[1][1]).toBe(points(other.container)[0][1])
  })

  it('keeps a value above the maximum inside the picture', () => {
    const { container } = render(<Sparkline values={[0, 9]} max={4} label="Over" />)
    const top = points(container)[1][1]
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top).toBe(
      points(render(<Sparkline values={[0, 4]} max={4} label="Full" />).container)[1][1],
    )
  })

  it('shows the flat baseline for an all-zero series, or a maximum of 0', () => {
    const { container } = render(<Sparkline values={[0, 0, 0]} max={0} label="Quiet" />)
    const ys = points(container).map(([, y]) => y)
    expect(new Set(ys).size).toBe(1)
    expect(container.querySelector('line')).toBeTruthy()
  })

  it('draws one value as a single dot, and no values as the baseline alone', () => {
    const one = render(<Sparkline values={[3]} max={3} label="One" />)
    expect(one.container.querySelector('circle')).toBeTruthy()
    expect(one.container.querySelector('polyline')).toBeNull()
    const none = render(<Sparkline values={[]} max={3} label="None" />)
    expect(none.container.querySelector('line')).toBeTruthy()
    expect(none.container.querySelector('polyline')).toBeNull()
  })

  it('draws from theme tokens only', () => {
    const { container } = render(<Sparkline values={[1, 2]} max={2} label="Sample" />)
    expect(container.querySelector('polyline')?.getAttribute('class')).toContain('stroke-primary')
    expect(container.querySelector('line')?.getAttribute('class')).toContain('stroke-border')
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i)
  })

  it('is accessible', async () => {
    const { container } = render(<Sparkline values={[0, 2, 5]} max={5} label="Sample: 0, 2, 5" />)
    await expectAccessible(container)
  })
})
