// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PanelHeader, StatusBadgeButton } from './PanelHeader'

afterEach(cleanup)

describe('PanelHeader (#1417)', () => {
  it('puts the badge at the end of the title’s line, a button that presses once', () => {
    const onBadgePress = vi.fn()
    render(
      <PanelHeader badge={{ certainty: 'estimate', label: 'Proposed' }} onBadgePress={onBadgePress}>
        <h3>Title</h3>
      </PanelHeader>,
    )
    const button = screen.getByRole('button', { name: 'Proposed, what this means' })
    expect(button.closest('div')).toBe(screen.getByText('Title').parentElement)
    fireEvent.click(button)
    expect(onBadgePress).toHaveBeenCalledTimes(1)
  })

  it('shows the title alone with no badge, and a plain label when nothing opens', () => {
    const { rerender } = render(
      <PanelHeader>
        <h3>Title</h3>
      </PanelHeader>,
    )
    expect(screen.queryByText('Estimate')).toBeNull()
    rerender(
      <PanelHeader badge={{ certainty: 'estimate' }}>
        <h3>Title</h3>
      </PanelHeader>,
    )
    expect(screen.getByText('Estimate')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps a hidden, unfocusable copy of a later year’s badge while it has none of its own', () => {
    const room = { certainty: 'estimate' as const, label: 'Proposed' }
    const { rerender, container } = render(
      <PanelHeader room={room}>
        <h3>Title</h3>
      </PanelHeader>,
    )
    const hidden = screen.getByText('Proposed').closest('[aria-hidden="true"]')
    expect(hidden?.className).toContain('invisible')
    expect(container.querySelector('button')).toBeNull()
    rerender(
      <PanelHeader room={room} badge={{ certainty: 'estimate', label: 'Proposed' }}>
        <h3>Title</h3>
      </PanelHeader>,
    )
    expect(screen.getAllByText('Proposed')).toHaveLength(1)
    expect(container.querySelector('[aria-hidden="true"].invisible')).toBeNull()
  })
})

describe('StatusBadgeButton', () => {
  it('says the year’s own words in the certainty’s look', () => {
    render(<StatusBadgeButton badge={{ certainty: 'estimate', label: 'Proposed' }} />)
    expect(screen.getByText('Proposed').className).toContain('text-warning-strong')
  })
})
