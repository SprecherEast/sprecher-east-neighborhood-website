// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib/content'
import { PageHeader } from '@/platform/ui/PageHeader'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { EventDetail } from '../domain/types'
import { eventHeaderProps } from './eventHeader'

afterEach(cleanup)

const event: EventDetail = {
  id: 7,
  slug: 'potluck',
  title: 'Fall potluck',
  date: '2026-11-02T00:00:00.000Z',
  timeStart: '6:00 PM',
  timeEnd: '8:00 PM',
  cancelled: false,
  officialBody: null,
  categories: [{ id: 1, title: 'Social' }],
  description: 'Bring a dish.',
  locationName: 'Park shelter',
  place: { kind: 'venue', label: 'Park shelter' },
  image: null,
  locationType: 'in-person',
  locationAddress: '4605 Sprecher Rd',
  mapsHref: null,
  registrationUrl: null,
  agendaUrl: null,
  content: null,
  meta: { title: null, description: null, image: null },
}

const photo = { id: 3, alt: 'The park shelter', url: '/api/media/file/shelter.webp' } as ImageRef

describe('eventHeaderProps', () => {
  it('heads an event without a photo plainly, with its category pill and facts (#461)', () => {
    const props = eventHeaderProps(event)
    expect(props.variant).toBeUndefined()

    render(<PageHeader {...props} />)
    expect(screen.getByText('Social').className).toContain('text-primary-strong')
    expect(screen.getByText('Time').nextElementSibling?.textContent).toMatch(/^6:00 PM – 8:00 PM /)
    expect(screen.getByText('Format').nextElementSibling?.textContent).toBe('In Person')
    expect(screen.getByText('Date').nextElementSibling?.querySelector('time')).not.toBeNull()
  })

  it.each([
    ['a venue', event, 'Park shelter'],
    ['online', { ...event, place: { kind: 'online', label: 'Online' } } as EventDetail, 'Online'],
    [
      'to be confirmed',
      {
        ...event,
        place: { kind: 'unconfirmed', label: 'Location to be confirmed' },
      } as EventDetail,
      'Location to be confirmed',
    ],
  ])('states the place in the facts: %s (#873)', async (_, e, text) => {
    const { container } = render(<PageHeader {...eventHeaderProps(e)} />)

    expect(screen.getByText('Location').nextElementSibling?.textContent).toBe(text)
    await expectAccessible(container)
  })

  it('puts an event with a photo on it, its category on the photo', () => {
    const props = eventHeaderProps({ ...event, image: photo })
    expect(props).toMatchObject({ variant: 'image', image: photo, title: 'Fall potluck' })

    render(<PageHeader {...props} />)
    expect(screen.getByText('Social').className).toContain('bg-scrim/60')
  })

  it('leaves out the time and format it does not know', () => {
    render(<PageHeader {...eventHeaderProps({ ...event, timeStart: null, locationType: null })} />)

    expect(screen.queryByText('Time')).toBeNull()
    expect(screen.queryByText('Format')).toBeNull()
  })

  describe('a cancelled event (#122)', () => {
    it('leads the eyebrow with a "Cancelled" label in words, before its categories', async () => {
      const { container } = render(
        <PageHeader {...eventHeaderProps({ ...event, cancelled: true })} />,
      )

      const label = screen.getByText('Cancelled')
      expect(label.className).toContain('text-destructive-strong')
      expect(label.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
      expect(label.parentElement?.textContent).toBe('CancelledSocial')
      expect(screen.getByRole('heading', { level: 1, name: 'Fall potluck' })).toBeDefined()
      await expectAccessible(container)
    })

    it('puts the label on the photo, on its own scrim', () => {
      render(<PageHeader {...eventHeaderProps({ ...event, cancelled: true, image: photo })} />)

      expect(screen.getByText('Cancelled').className).toContain('bg-scrim/60')
    })

    it('shows the label even when the event has no categories', () => {
      render(<PageHeader {...eventHeaderProps({ ...event, cancelled: true, categories: [] })} />)

      expect(screen.getByText('Cancelled')).toBeDefined()
    })

    it('shows no label on an event that goes ahead', () => {
      render(<PageHeader {...eventHeaderProps(event)} />)

      expect(screen.queryByText('Cancelled')).toBeNull()
    })
  })

  describe('an official meeting (#122)', () => {
    const council: EventDetail = { ...event, title: 'Common Council', officialBody: 'city' }

    it('names the body in the eyebrow, after "Cancelled" and before the categories', async () => {
      const { container } = render(
        <PageHeader {...eventHeaderProps({ ...council, cancelled: true })} />,
      )

      const label = screen.getByText('City of Madison meeting')
      expect(label.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
      expect(label.parentElement?.textContent).toBe('CancelledCity of Madison meetingSocial')
      await expectAccessible(container)
    })

    it('puts the label on the photo, on its own scrim', () => {
      render(
        <PageHeader {...eventHeaderProps({ ...council, officialBody: 'county', image: photo })} />,
      )

      expect(screen.getByText('Dane County meeting').className).toContain('bg-scrim/60')
    })

    it('shows the label even when the meeting has no categories', () => {
      render(<PageHeader {...eventHeaderProps({ ...council, categories: [] })} />)

      expect(screen.getByText('City of Madison meeting')).toBeDefined()
    })
  })
})
