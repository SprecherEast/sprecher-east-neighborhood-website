import { describe, expect, it } from 'vitest'

import type { BillShareYear } from './billShare'
import { joinNames, reservedNote, ROUGH_NOTE, unconfirmedNote } from './billShareNotes'

const year = (y: number, rates: BillShareYear['rates']): BillShareYear => ({
  year: y,
  label: `${y} rates`,
  averageHome: 500000,
  rates,
  source: null,
})

const ALL = { schools: 12, city: 7, county: 3, matc: 1.5 }
const YEARS = [year(2026, ALL), year(2027, { city: 7.1 })]

describe('joinNames', () => {
  it('writes a list the way a neighbor would say it', () => {
    expect(joinNames([])).toBe('')
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A and B')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C')
  })
})

describe('ROUGH_NOTE', () => {
  it('says the estimate is rough and why a real bill differs', () => {
    expect(ROUGH_NOTE).toMatch(/rough estimate/i)
    expect(ROUGH_NOTE).toMatch(/credits|exemptions/i)
  })
})

describe('unconfirmedNote', () => {
  it('says which bodies have not set the year’s rates and whose rates stand in', () => {
    const note = unconfirmedNote(YEARS, 1)
    expect(note).toContain('2027 rates are not confirmed')
    expect(note).toContain('Madison schools, Dane County and Madison College (MATC)')
    expect(note).toContain('2026’s')
  })

  it('has nothing to say about a year every body has set', () => {
    expect(unconfirmedNote(YEARS, 0)).toBeNull()
  })
})

describe('reservedNote', () => {
  it('is the note of the year that has one, so its room can be kept for every year', () => {
    expect(reservedNote(YEARS)).toBe(unconfirmedNote(YEARS, 1))
  })

  it('is null when no year has one', () => {
    expect(reservedNote([YEARS[0] as BillShareYear])).toBeNull()
  })
})
