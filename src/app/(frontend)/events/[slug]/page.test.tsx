// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The modules are replaced: this tests the page's wiring, not events or the renderer
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock('@/modules/events/server', () => ({
  eventByline: () => [{ label: 'When', value: 'Sat, Nov 7' }],
  eventHeaderProps: () => ({ title: 'Leaf raking' }),
  EventLocation: () => null,
  eventJsonLd: () => ({}),
  findUpcomingEvents: async () => [],
  getEventBySlug: async () => ({ id: 1, slug: 'leaf-raking', title: 'Leaf raking', image: null }),
  listEventSlugs: async () => [],
  OfficialAgenda: () => null,
  SidebarEvents: () => null,
}))
vi.mock('@/modules/site/server', () => ({ PayloadRedirects: () => null }))
vi.mock('@/platform/richtext/RichText', () => ({ RichText: () => null }))
vi.mock('@/platform/seo/generateMeta', () => ({ generateMeta: async () => ({}) }))

import EventPage from './page'

afterEach(cleanup)

describe('/events/[slug]', () => {
  it('ends its sidebar with a "More events" box whose button says the rest', async () => {
    render(await EventPage({ params: Promise.resolve({ slug: 'leaf-raking' }) }))

    expect(screen.getByRole('heading', { name: 'More events' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View All Events' }).getAttribute('href')).toBe(
      '/events',
    )
    expect(screen.queryByText(/Stay in the Loop|find ways to connect/)).toBeNull()
  })

  it('draws the event’s when and where as the metadata bar in the article column (#1002)', async () => {
    render(await EventPage({ params: Promise.resolve({ slug: 'leaf-raking' }) }))

    expect(screen.getByText('When').closest('dl')?.closest('header')).toBeNull()
    expect(screen.getByText('When').nextElementSibling?.textContent).toBe('Sat, Nov 7')
  })

  it('gives the bar the width of what sits under it, the whole column, not the reading width (#1002)', async () => {
    render(await EventPage({ params: Promise.resolve({ slug: 'leaf-raking' }) }))

    const bar = screen.getByText('When').closest('dl')?.parentElement?.parentElement
    expect(bar?.className).not.toMatch(/max-w|mx-0/)
  })
})
