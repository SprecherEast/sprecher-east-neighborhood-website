// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib/content'
import { MetaBar } from '@/platform/ui/MetaBar'
import { PageHeader } from '@/platform/ui/PageHeader'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { EventDetail } from '../domain/types'
import { eventByline, eventHeaderProps } from './eventHeader'

/** An event's metadata as the page draws it: the bar in the article column (#1002) */
const Bar = ({ event: e }: { event: EventDetail }) => <MetaBar items={eventByline(e)} />

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
  it('heads an event on a plain band with its category pill, and no facts: they are in the bar (#461, #1013, #1002)', () => {
    const props = eventHeaderProps(event)
    expect(props.variant).toBe('band')
    expect(props).not.toHaveProperty('facts')

    const { container } = render(<PageHeader {...props} />)
    expect(screen.getByText('Social').className).toContain('text-primary-strong')
    expect(container.querySelector('dl')).toBeNull()
  })

  describe('eventByline (#1002)', () => {
    it('says when: the date with its time range and zone', () => {
      render(<Bar event={event} />)

      const when = screen.getByText('When').nextElementSibling
      expect(when?.querySelector('time')).not.toBeNull()
      expect(when?.textContent).toMatch(/ · 6:00 PM – 8:00 PM /)
    })

    it('says where, with the format beside the venue', () => {
      render(<Bar event={event} />)

      expect(screen.getByText('Where').nextElementSibling?.textContent).toBe(
        'Park shelter · In Person',
      )
    })

    it('keeps the hybrid format with the venue', () => {
      render(<Bar event={{ ...event, locationType: 'hybrid' }} />)

      expect(screen.getByText('Where').nextElementSibling?.textContent).toBe(
        'Park shelter · Hybrid',
      )
    })

    it.each([
      [
        'online, without saying "Virtual" twice',
        { ...event, locationType: 'virtual', place: { kind: 'online', label: 'Online' } },
        'Online',
      ],
      [
        'to be confirmed',
        { ...event, place: { kind: 'unconfirmed', label: 'Location to be confirmed' } },
        'Location to be confirmed · In Person',
      ],
    ] as [string, EventDetail, string][])(
      'states a place that is not a venue: %s (#873)',
      async (_, e, text) => {
        const { container } = render(<Bar event={e} />)

        expect(screen.getByText('Where').nextElementSibling?.textContent).toBe(text)
        await expectAccessible(container)
      },
    )

    it('leaves out the time and format it does not know', () => {
      render(<Bar event={{ ...event, timeStart: null, locationType: null }} />)

      expect(screen.getByText('When').nextElementSibling?.textContent).not.toContain('·')
      expect(screen.getByText('Where').nextElementSibling?.textContent).toBe('Park shelter')
    })

    it('keeps a long venue name in the bar without a sideways scroll: it wraps in its item', () => {
      const long = 'The community room at the far end of the long lakeside building '.repeat(4)
      render(<Bar event={{ ...event, place: { kind: 'venue', label: long } }} />)

      expect(screen.getByText('Where').nextElementSibling?.className).toContain('break-words')
    })
  })

  it('keeps the picture out of the band, with or without one (#1013)', () => {
    for (const image of [photo, null]) {
      const props = eventHeaderProps({ ...event, image })
      expect(props).toMatchObject({ variant: 'band', title: 'Fall potluck' })
      expect(props).not.toHaveProperty('image')

      const { container } = render(<PageHeader {...props} />)
      expect(container.querySelector('img')).toBeNull()
      // Labels sit on the band's surface in their usual look, not on a scrim
      expect(screen.getByText('Social').className).toContain('text-primary-strong')
      cleanup()
    }
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

    it('shows the label even when the meeting has no categories', () => {
      render(<PageHeader {...eventHeaderProps({ ...council, categories: [] })} />)

      expect(screen.getByText('City of Madison meeting')).toBeDefined()
    })
  })
})
