import { describe, expect, it } from 'vitest'

import type { Event, Media } from '@/payload-types'

import { SUMMARY_FIELDS, toEventDetail, toEventSummary } from './mappers'

const image = { id: 4, alt: 'Park shelter', url: '/api/media/file/park.jpg' } as Media

const doc: Event = {
  id: 7,
  slug: 'potluck',
  title: 'Fall potluck',
  date: '2026-11-02T00:00:00.000Z',
  timeStart: '6:00 PM',
  timeEnd: '8:00 PM',
  cancelled: false,
  categories: [{ id: 3, title: 'Social', slug: 'social', updatedAt: '', createdAt: '' }, 9],
  description: 'Bring a dish.',
  locationType: 'in-person',
  locationName: 'Park shelter',
  locationAddress: '4605 Sprecher Rd',
  mapsUrl: null,
  registrationUrl: 'https://example.com/register',
  heroImage: image,
  content: null,
  meta: { title: 'Potluck', description: 'A potluck', image },
  updatedAt: '2026-10-01T12:00:00.000Z',
  createdAt: '2026-10-01T12:00:00.000Z',
}

describe('toEventSummary', () => {
  it('keeps what a card shows and names the image', () => {
    expect(toEventSummary(doc)).toEqual({
      id: 7,
      slug: 'potluck',
      title: 'Fall potluck',
      date: '2026-11-02T00:00:00.000Z',
      timeStart: '6:00 PM',
      timeEnd: '8:00 PM',
      cancelled: false,
      officialBody: null,
      categories: [{ id: 3, title: 'Social' }],
      description: 'Bring a dish.',
      locationName: 'Park shelter',
      place: { kind: 'venue', label: 'Park shelter' },
      image,
    })
  })

  it('turns missing fields into null', () => {
    const summary = toEventSummary({
      id: 8,
      slug: 'cleanup',
      title: 'Park cleanup',
      date: '2026-11-03T00:00:00.000Z',
    })
    expect(summary).toMatchObject({
      timeStart: null,
      timeEnd: null,
      cancelled: false,
      officialBody: null,
      categories: [],
      description: null,
      locationName: null,
      image: null,
    })
  })

  it('gives every event a place: venue, online or to be confirmed, and selects what decides it (#873)', () => {
    expect(SUMMARY_FIELDS).toHaveProperty('locationType', true)
    expect(toEventSummary({ ...doc, locationName: null, locationType: 'virtual' }).place).toEqual({
      kind: 'online',
      label: 'Online',
    })
    expect(toEventSummary({ ...doc, locationName: null, locationType: 'in-person' }).place).toEqual({
      kind: 'unconfirmed',
      label: 'Location to be confirmed',
    })
    // The page can also use the street address when there is no venue name
    expect(toEventDetail({ ...doc, locationName: null }).place).toEqual({
      kind: 'venue',
      label: '4605 Sprecher Rd',
    })
  })

  it('carries the cancelled flag to the card and the page (#122)', () => {
    expect(toEventSummary({ ...doc, cancelled: true }).cancelled).toBe(true)
    expect(toEventDetail({ ...doc, cancelled: true }).cancelled).toBe(true)
    expect(toEventSummary({ ...doc, cancelled: null }).cancelled).toBe(false)
  })

  it('selects the flag, so listings can show it', () => {
    expect(SUMMARY_FIELDS).toHaveProperty('cancelled', true)
  })

  it('carries an official meeting’s body to the card, and selects it (#122)', () => {
    expect(toEventSummary({ ...doc, officialBody: 'city' }).officialBody).toBe('city')
    expect(toEventSummary({ ...doc, officialBody: 'county' }).officialBody).toBe('county')
    expect(SUMMARY_FIELDS).toHaveProperty('officialBody', true)
  })

  it('drops an image that was not loaded, which is only an id', () => {
    expect(toEventSummary({ ...doc, heroImage: 4 }).image).toBeNull()
  })
})

describe('toEventDetail', () => {
  it('adds the place, links, content and search fields', () => {
    expect(toEventDetail(doc)).toMatchObject({
      locationType: 'in-person',
      locationAddress: '4605 Sprecher Rd',
      mapsHref: 'https://www.google.com/maps/search/?api=1&query=4605%20Sprecher%20Rd',
      registrationUrl: 'https://example.com/register',
      content: null,
      meta: { title: 'Potluck', description: 'A potluck', image },
    })
  })

  describe('an official meeting (#122)', () => {
    const council = {
      ...doc,
      officialBody: 'city' as const,
      agendaUrl: 'https://madison.legistar.com/Calendar.aspx',
    }

    it('keeps its body and its agenda link', () => {
      expect(toEventDetail(council)).toMatchObject({
        officialBody: 'city',
        agendaUrl: 'https://madison.legistar.com/Calendar.aspx',
      })
    })

    it('has neither when they are unset', () => {
      expect(toEventDetail(doc)).toMatchObject({ officialBody: null, agendaUrl: null })
      expect(toEventDetail({ ...council, agendaUrl: '' }).agendaUrl).toBeNull()
    })

    it('drops an agenda link left behind on an event that is no longer official', () => {
      expect(toEventDetail({ ...council, officialBody: null }).agendaUrl).toBeNull()
    })

    it('never passes on a link that is not https', () => {
      expect(toEventDetail({ ...council, agendaUrl: 'javascript:alert(1)' }).agendaUrl).toBeNull()
      expect(toEventDetail({ ...council, agendaUrl: 'http://example.com' }).agendaUrl).toBeNull()
    })
  })

  it('has empty search fields when the event has none', () => {
    expect(toEventDetail({ ...doc, meta: undefined }).meta).toEqual({
      title: null,
      description: null,
      image: null,
    })
  })
})
