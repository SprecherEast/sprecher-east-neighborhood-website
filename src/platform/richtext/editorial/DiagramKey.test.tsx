// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { DiagramKey } from './DiagramKey'

afterEach(cleanup)

describe('DiagramKey', () => {
  it('numbers each marker once, in the accent colour, readable as "Marker N"', async () => {
    const { container } = render(
      <DiagramKey
        items={[
          { label: 'North roundabout', text: 'Ramps meet the crossing road.' },
          { label: 'Westbound loop', text: null },
        ]}
      />,
    )

    const list = screen.getByRole('list', { name: 'Diagram key' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '1Marker 1: North roundabout: \u00a0· Ramps meet the crossing road.',
      '2Marker 2: Westbound loop',
    ])
    const circle = items[0].querySelector('[aria-hidden="true"]')
    expect(circle?.textContent).toBe('1')
    expect(circle?.className).toContain('bg-diagram-marker')
    // White on the diagram's own orange with a white ring, like the markers on the photo (#658, #743)
    expect(circle?.className).toContain('text-on-image')
    expect(circle?.className).toContain('ring-on-image')
    await expectAccessible(container)
  })

  it('renders nothing without items', () => {
    const { container } = render(<DiagramKey items={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
