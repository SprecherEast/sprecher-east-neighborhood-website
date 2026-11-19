import { describe, expect, it } from 'vitest'

import {
  formatOfficialBody,
  isAgendaUrl,
  isOfficialBody,
  OFFICIAL_BODIES,
  validateAgendaUrl,
} from './officialMeetings'

describe('OFFICIAL_BODIES (#122)', () => {
  it('lists the city and the county, named in full', () => {
    expect(OFFICIAL_BODIES.map(({ value }) => value)).toEqual(['city', 'county'])
    expect(formatOfficialBody('city')).toBe('City of Madison')
    expect(formatOfficialBody('county')).toBe('Dane County')
  })

  it('knows only those bodies', () => {
    expect(isOfficialBody('city')).toBe(true)
    expect(isOfficialBody('state')).toBe(false)
    expect(isOfficialBody(null)).toBe(false)
  })
})

describe('validateAgendaUrl (#122)', () => {
  it('accepts a full https link, and a blank one (the link is optional)', () => {
    expect(validateAgendaUrl('https://madison.legistar.com/Calendar.aspx')).toBe(true)
    expect(validateAgendaUrl('HTTPS://Madison.Legistar.com/Calendar.aspx')).toBe(true)
    expect(validateAgendaUrl(null)).toBe(true)
    expect(validateAgendaUrl(undefined)).toBe(true)
    expect(validateAgendaUrl('')).toBe(true)
  })

  it.each([
    'http://madison.legistar.com/Calendar.aspx',
    'javascript:alert(1)',
    '/events/council',
    'madison.legistar.com',
    'https://',
    'ftp://example.com/agenda.pdf',
    // `new URL` would quietly strip or accept these, but the link is stored as typed
    ' https://madison.legistar.com/Calendar.aspx',
    'https://madison.legistar.com/Calendar.aspx ',
    '\thttps://madison.legistar.com/Calendar.aspx',
    'https://madison.leg\nistar.com/Calendar.aspx',
    'https:madison.legistar.com',
    'https:\\\\madison.legistar.com',
    'https://user:secret@madison.legistar.com/Calendar.aspx',
    `https://madison.legistar.com/${'a'.repeat(2048)}`,
  ])('refuses %s with a message the editor can act on', (value) => {
    expect(validateAgendaUrl(value)).toBe('Enter the full agenda link, starting with https://')
    expect(isAgendaUrl(value)).toBe(false)
  })

  it('refuses a value that is not text', () => {
    expect(isAgendaUrl(42)).toBe(false)
    expect(validateAgendaUrl(42)).not.toBe(true)
  })
})
