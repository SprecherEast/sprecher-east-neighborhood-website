// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BarTrack } from './BarTrack'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('BarTrack', () => {
  it('draws the fill as wide as its percent, on a muted track, with its mark', () => {
    const { container } = render(
      <BarTrack
        width={37.456}
        radius={5}
        fillClassName="fill-primary-fill"
        mark={{ 'data-bar': 'x' }}
      />,
    )

    const fill = container.querySelector('[data-bar="x"]')
    expect(fill?.getAttribute('width')).toBe('37.46%')
    expect(fill?.getAttribute('class')).toContain('fill-primary-fill')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('rect')?.getAttribute('class')).toBe('fill-muted')
  })

  it('wraps the fill to animate it and outlines it when asked', () => {
    const { container } = render(
      <BarTrack
        width={50}
        radius={5}
        fillClassName="fill-primary-fill"
        mark={{ 'data-bar': 'x' }}
        reveal="chart-fill-x"
        edge={{ className: 'stroke-chart-ramp-edge', width: 2 }}
      />,
    )

    const fill = container.querySelector('[data-bar="x"]')
    expect(fill?.parentElement?.getAttribute('class')).toBe('chart-fill-x')
    expect(fill?.getAttribute('class')).toContain('stroke-chart-ramp-edge')
    expect(fill?.getAttribute('stroke-width')).toBe('2')
  })

  it('has nothing for axe to flag', async () => {
    const { container } = render(
      <BarTrack
        width={50}
        radius={5}
        fillClassName="fill-primary-fill"
        mark={{ 'data-bar': 'x' }}
      />,
    )

    await expectAccessible(container)
  })
})
