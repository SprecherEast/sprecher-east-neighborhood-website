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

  // Over a page's photo the card is the shared frosted glass (#1268); anywhere else it is the
  // tinted card it always was
  describe('over a backdrop', () => {
    const cta = (glass?: boolean) =>
      render(
        <SidebarCTA
          heading="Get Involved"
          description="Know something we’re missing?"
          buttonLabel="Get Involved"
          buttonHref="/get-involved"
          glass={glass}
        />,
      )

    it('is a GlassPanel, with its text in the on-image colour', () => {
      const { container } = cta(true)

      const panel = container.querySelector('[data-glass-panel]')
      expect(panel).toBeTruthy()
      expect(panel?.contains(screen.getByRole('heading', { name: 'Get Involved' }))).toBe(true)
      expect(panel?.contains(screen.getByRole('link', { name: 'Get Involved' }))).toBe(true)
      expect(screen.getByRole('heading', { name: 'Get Involved' }).className).toContain(
        'text-on-image',
      )
      expect(screen.getByText('Know something we’re missing?').className).toContain('text-on-image')
    })

    it('is the tinted card, as before, when the page has no backdrop', () => {
      const plain = cta().container.innerHTML
      cleanup()
      const off = cta(false).container.innerHTML

      expect(plain).toBe(off)
      expect(plain).not.toContain('data-glass-panel')
      expect(plain).toContain('bg-')
    })
  })
})
