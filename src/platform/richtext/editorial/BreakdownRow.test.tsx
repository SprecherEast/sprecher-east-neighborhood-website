// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BreakdownRow } from './BreakdownRow'
import { city } from './billShareFixtures'

const SPEC = city.cityBreakdown

describe('BreakdownRow (#1163, #1165)', () => {
  afterEach(cleanup)

  it('is a closed row of the bill holding the split alone, with thin bars, its title the heading', () => {
    const rowRef = createRef<HTMLDetailsElement>()
    render(
      <BreakdownRow
        title="Your City tax breakdown"
        spec={SPEC}
        factor={1}
        row={{ rowRef, openings: 0, onOpening: () => {} }}
      />,
    )
    const details = screen
      .getByText('Your City tax breakdown')
      .closest('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(rowRef.current).toBe(details)
    // Thin bars, and the chart's own title left to screen readers
    expect(details.querySelector('svg.h-3\\.5')).toBeNull()
    expect(details.querySelector('svg.h-2\\.5')).not.toBeNull()
  })

  it('sets its amounts in from the right, so they end before the bodies’ amounts and are not read as parts of the sum (#1196)', () => {
    const rowRef = createRef<HTMLDetailsElement>()
    const { container } = render(
      <BreakdownRow
        title="Your City tax breakdown"
        spec={SPEC}
        factor={1}
        row={{ rowRef, openings: 0, onOpening: () => {} }}
      />,
    )
    const body = container.querySelector('details > div') as HTMLElement
    expect(body.className).toContain('mr-6')
    expect(body.className).toContain('sm:mr-12')
    // The summary button itself keeps its full width
    expect(container.querySelector('summary')?.className).not.toContain('mr-')
  })

  it('tells the hook before a reader opens it, and fills again for each opening', () => {
    const onOpening = vi.fn()
    const rowRef = createRef<HTMLDetailsElement>()
    const { container, rerender } = render(
      <BreakdownRow
        title="Breakdown"
        spec={SPEC}
        factor={1}
        row={{ rowRef, openings: 0, onOpening }}
      />,
    )
    fireEvent.click(screen.getByText('Breakdown'))
    expect(onOpening).toHaveBeenCalledTimes(1)
    rerender(
      <BreakdownRow
        title="Breakdown"
        spec={SPEC}
        factor={1}
        row={{ rowRef, openings: 1, onOpening }}
      />,
    )
    expect(container.querySelector('.chart-fill-x')).not.toBeNull()
  })
})
