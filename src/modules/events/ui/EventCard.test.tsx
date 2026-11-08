// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { EventSummary } from '../domain/types'
import { EventCard } from './EventCard'
import { SidebarEvents } from './SidebarEvents'

afterEach(cleanup)

const event: EventSummary = {
  id: 7,
  slug: 'potluck',
  title: 'Fall potluck',
  date: '2026-11-02T00:00:00.000Z',
  timeStart: '6:00 PM',
  timeEnd: null,
  cancelled: false,
  officialBody: null,
  categories: [{ id: 1, title: 'Social' }],
  description: 'Bring a dish.',
  locationName: 'Park shelter',
  place: { kind: 'venue', label: 'Park shelter' },
  image: null,
}
const cancelled = { ...event, cancelled: true }
const council: EventSummary = {
  ...event,
  slug: 'council',
  title: 'Common Council',
  officialBody: 'city',
}

describe('EventCard, place (#873)', () => {
  const online: EventSummary = { ...event, place: { kind: 'online', label: 'Online' } }
  const unconfirmed: EventSummary = {
    ...event,
    place: { kind: 'unconfirmed', label: 'Location to be confirmed' },
  }

  it.each([
    ['full', false],
    ['compact', true],
  ])(
    'shows the venue, "Online" or "Location to be confirmed" on the %s card',
    async (_, compact) => {
      for (const [e, text] of [
        [event, 'Park shelter'],
        [online, 'Online'],
        [unconfirmed, 'Location to be confirmed'],
      ] as const) {
        const { container } = render(<EventCard event={e} compact={compact} />)
        expect(screen.getByText(text)).toBeDefined()
        await expectAccessible(container)
        cleanup()
      }
    },
  )

  it.each([
    ['full', false],
    ['compact', true],
  ])('keeps a very long place to one line on the %s card, so cards stay level', (_, compact) => {
    const label =
      'The Sprecher East Neighborhood Community Center and Recreation Annex Building, '.repeat(3)
    render(<EventCard event={{ ...event, place: { kind: 'venue', label } }} compact={compact} />)

    const text = screen.getByText(label.trim())
    expect(text.className).toContain('line-clamp-1')
    expect(text.className).toContain('min-w-0')
  })

  it('shows it on a past event too, since the card does not look at the date', () => {
    render(<EventCard event={{ ...unconfirmed, date: '2020-01-05T00:00:00.000Z' }} />)

    expect(screen.getByText('Location to be confirmed')).toBeDefined()
  })
})

describe('EventCard, for a cancelled event (#122)', () => {
  it.each([
    ['the full card', false],
    ['the compact card', true],
  ])('labels %s "Cancelled" in words, inside the title’s link', async (_, compact) => {
    const { container } = render(<EventCard event={cancelled} compact={compact} />)

    const link = screen.getByRole('link', { name: 'Cancelled: Fall potluck' })
    expect(link.getAttribute('href')).toBe('/events/potluck')
    expect(screen.getByRole('heading', { name: 'Cancelled: Fall potluck' })).toBeDefined()
    // Text and an icon, not colour alone; the icon is decoration
    const label = screen.getByText('Cancelled')
    expect(label.className).toContain('text-destructive-strong')
    expect(label.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    await expectAccessible(container)
  })

  it('keeps the rest of the card: date, time, place and category', () => {
    const { container } = render(<EventCard event={cancelled} />)

    expect(container.querySelector('time')).not.toBeNull()
    expect(screen.getByText('6:00 PM', { exact: false })).toBeDefined()
    expect(screen.getByText('Park shelter')).toBeDefined()
    expect(screen.getByText('Social')).toBeDefined()
  })

  it.each([false, true])('shows no label on an event that goes ahead (compact: %s)', (compact) => {
    render(<EventCard event={event} compact={compact} />)

    expect(screen.queryByText('Cancelled')).toBeNull()
    expect(screen.getByRole('link', { name: 'Fall potluck' })).toBeDefined()
  })
})

describe('SidebarEvents, with a cancelled event (#122)', () => {
  it('lists it with its "Cancelled" label, next to one that goes ahead', async () => {
    const { container } = render(
      <SidebarEvents
        events={[cancelled, { ...event, id: 8, slug: 'cleanup', title: 'Cleanup' }]}
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    // The label comes first and reads as one name with the title, as on the cards
    expect(screen.getByRole('link', { name: /Cancelled: Fall potluck/ })).toBeDefined()
    expect(screen.getByRole('link', { name: /Cleanup/ }).textContent).not.toContain('Cancelled')
    await expectAccessible(container)
  })
})

describe('EventCard, for an official meeting (#122)', () => {
  it.each([
    ['the full card', false],
    ['the compact card', true],
  ])('labels %s "Official meeting" in words, inside the title’s link', async (_, compact) => {
    const { container } = render(<EventCard event={council} compact={compact} />)

    const link = screen.getByRole('link', { name: 'Official meeting: Common Council' })
    expect(link.getAttribute('href')).toBe('/events/council')
    const label = screen.getByText('Official meeting')
    expect(label.className).toContain('text-primary-strong')
    expect(label.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    await expectAccessible(container)
  })

  it.each([false, true])(
    'shows a cancelled official meeting as both, cancelled first (compact: %s)',
    async (compact) => {
      const { container } = render(
        <EventCard event={{ ...council, cancelled: true }} compact={compact} />,
      )

      expect(
        screen.getByRole('link', { name: 'Cancelled, Official meeting: Common Council' }),
      ).toBeDefined()
      const [first, second] = Array.from(container.querySelectorAll('h3 span > span'))
      expect(first?.textContent).toBe('Cancelled')
      expect(second?.textContent).toBe(',')
      await expectAccessible(container)
    },
  )

  it('shows no official label on a neighbourhood event', () => {
    render(<EventCard event={event} />)

    expect(screen.queryByText('Official meeting')).toBeNull()
  })
})

describe('SidebarEvents, with an official meeting (#122)', () => {
  it('labels it in words, with a cancelled one reading both', async () => {
    const { container } = render(
      <SidebarEvents
        events={[
          council,
          { ...council, id: 9, slug: 'board', title: 'County Board', cancelled: true },
          event,
        ]}
      />,
    )

    expect(screen.getByRole('link', { name: /Official meeting: Common Council/ })).toBeDefined()
    expect(
      screen.getByRole('link', { name: /Cancelled, Official meeting: County Board/ }),
    ).toBeDefined()
    expect(screen.getByRole('link', { name: /Fall potluck/ }).textContent).not.toContain(
      'Official meeting',
    )
    await expectAccessible(container)
  })
})

describe('EventCard, compact, in a row of cards (#741)', () => {
  it('starts the date badge and the title block on one line, however many lines the title takes', () => {
    const { container } = render(<EventCard event={event} compact />)
    const card = container.querySelector('article') as HTMLElement

    expect(card.className).toContain('items-start')
    expect(card.className).not.toContain('items-center')
  })
})
