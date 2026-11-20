// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockEvent = vi.hoisted(() => ({
  id: 1,
  slug: 'leaf-raking',
  title: 'Leaf raking',
  image: null as null,
  date: '2026-11-07T00:00:00.000Z',
  cancelled: false,
  registrationUrl: 'https://example.com/register' as string | null,
}))

// The modules are replaced: this tests the page's wiring, not events or the renderer
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock('@/modules/events/server', () => ({
  eventByline: () => [{ label: 'When', value: 'Sat, Nov 7' }],
  eventHeaderProps: () => ({ title: 'Leaf raking' }),
  EventLocation: () => null,
  eventJsonLd: () => ({}),
  findUpcomingEvents: async () => [],
  getEventBySlug: async () => mockEvent,
  listEventSlugs: async () => [],
  OfficialAgenda: () => null,
  SidebarEvents: () => null,
}))
vi.mock('@/modules/site/server', () => ({ PayloadRedirects: () => null }))
vi.mock('@/platform/richtext/RichText', () => ({ RichText: () => null }))
vi.mock('@/platform/seo/generateMeta', () => ({ generateMeta: async () => ({}) }))

import EventPage from './page'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T18:00:00.000Z'))
  mockEvent.date = '2026-11-07T00:00:00.000Z'
  mockEvent.cancelled = false
  mockEvent.registrationUrl = 'https://example.com/register'
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('/events/[slug] registration (#1012)', () => {
  const open = async () =>
    render(await EventPage({ params: Promise.resolve({ slug: 'leaf-raking' }) }))

  it('keeps the register button on an upcoming event, with no "passed" line', async () => {
    await open()

    expect(screen.getByRole('link', { name: /Register for This Event/ })).toBeTruthy()
    expect(screen.queryByText('This event has passed.')).toBeNull()
  })

  it('keeps the register button on an event dated today', async () => {
    mockEvent.date = '2026-11-05T00:00:00.000Z'
    await open()

    expect(screen.getByRole('link', { name: /Register for This Event/ })).toBeTruthy()
  })

  it('drops the register button from a past event and says it has passed', async () => {
    mockEvent.date = '2026-11-04T00:00:00.000Z'
    await open()

    expect(screen.queryByRole('link', { name: /Register/ })).toBeNull()
    expect(screen.getByText('This event has passed.')).toBeTruthy()
  })

  it('says a past event has passed even when it never had a register link', async () => {
    mockEvent.date = '2026-11-04T00:00:00.000Z'
    mockEvent.registrationUrl = null
    await open()

    expect(screen.getByText('This event has passed.')).toBeTruthy()
  })

  it('says only that a cancelled event is cancelled, past or not', async () => {
    mockEvent.date = '2026-11-04T00:00:00.000Z'
    mockEvent.cancelled = true
    await open()

    expect(screen.getByText('This event is cancelled.')).toBeTruthy()
    expect(screen.queryByText('This event has passed.')).toBeNull()
    expect(screen.queryByRole('link', { name: /Register/ })).toBeNull()
  })
})

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
