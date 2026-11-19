// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SidebarCTA } from './SidebarCTA'

afterEach(cleanup)

describe('SidebarCTA', () => {
  it('shows its heading, sentence and button', () => {
    render(
      <SidebarCTA
        heading="More events"
        description="See the full calendar."
        buttonLabel="View All Events"
        buttonHref="/events"
      />,
    )

    expect(screen.getByRole('heading', { name: 'More events' })).toBeTruthy()
    expect(screen.getByText('See the full calendar.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View All Events' }).getAttribute('href')).toBe(
      '/events',
    )
  })

  it('draws no empty sentence when the heading and button already say it', () => {
    const { container } = render(
      <SidebarCTA heading="More events" buttonLabel="View All Events" buttonHref="/events" />,
    )

    expect(container.querySelectorAll('p')).toHaveLength(0)
  })
})
