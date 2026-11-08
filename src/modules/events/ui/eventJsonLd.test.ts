import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Media } from '@/payload-types'

import type { EventDetail } from '../domain/types'
import { eventJsonLd } from './eventJsonLd'

const event: EventDetail = {
  id: 7,
  slug: 'potluck',
  title: 'Fall potluck',
  date: '2026-11-02T00:00:00.000Z',
  timeStart: null,
  timeEnd: null,
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

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://sprechereast.example')
})

describe('eventJsonLd', () => {
  it('describes the event as a schema.org Event on this site', () => {
    expect(eventJsonLd(event)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Fall potluck',
      url: 'https://sprechereast.example/events/potluck',
      startDate: '2026-11-02T00:00:00.000Z',
      description: 'Bring a dish.',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: {
        '@type': 'Organization',
        name: 'Sprecher East',
        url: 'https://sprechereast.example',
      },
      location: { '@type': 'Place', name: 'Park shelter', address: '4605 Sprecher Rd' },
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    })
  })

  it('tells search engines a cancelled event is cancelled, not scheduled (#122)', () => {
    expect(eventJsonLd({ ...event, cancelled: true }).eventStatus).toBe(
      'https://schema.org/EventCancelled',
    )
  })

  it('names the public body as the organizer of an official meeting, with no invented URL (#122)', () => {
    expect(eventJsonLd({ ...event, officialBody: 'city' }).organizer).toEqual({
      '@type': 'GovernmentOrganization',
      name: 'City of Madison',
    })
    expect(eventJsonLd({ ...event, officialBody: 'county' }).organizer).toEqual({
      '@type': 'GovernmentOrganization',
      name: 'Dane County',
    })
  })

  it('names the attendance mode for virtual and hybrid events', () => {
    expect(eventJsonLd({ ...event, locationType: 'virtual' }).eventAttendanceMode).toBe(
      'https://schema.org/OnlineEventAttendanceMode',
    )
    expect(eventJsonLd({ ...event, locationType: 'hybrid' }).eventAttendanceMode).toBe(
      'https://schema.org/MixedEventAttendanceMode',
    )
  })

  it('links the photo by its absolute URL, and leaves out a place it does not know', () => {
    const image = { id: 4, url: '/api/media/file/park.jpg' } as Media
    const jsonLd = eventJsonLd({ ...event, image, locationName: null, locationAddress: null })
    expect(jsonLd.image).toBe('https://sprechereast.example/api/media/file/park.jpg')
    expect(jsonLd).not.toHaveProperty('location')
  })
})
