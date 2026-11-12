import { describe, expect, it } from 'vitest'

import type { BillShareYear } from './billShare'
import {
  assumedNote,
  joinNames,
  reservedNote,
  ROUGH_NOTE,
  uniqueSources,
  unconfirmedNote,
} from './billShareNotes'

const year = (y: number, rates: BillShareYear['rates']): BillShareYear => ({
  year: y,
  label: `${y} rates`,
  note: '',
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
  it('says the estimate is rough and why a real bill differs, in one short line', () => {
    expect(ROUGH_NOTE).toMatch(/rough estimate/i)
    expect(ROUGH_NOTE).toMatch(/credits|exemptions/i)
    expect(ROUGH_NOTE.length).toBeLessThan(90)
  })
})

describe('unconfirmedNote', () => {
  it('says the City’s rate for the year is proposed, without naming the other bodies', () => {
    expect(unconfirmedNote(YEARS, 1)).toBe('The City’s 2027 tax rate is proposed, not confirmed.')
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

describe('uniqueSources', () => {
  const a = {
    label: 'A',
    href: 'https://example.org/a',
    external: true,
    appearance: 'default' as const,
  }
  const b = {
    label: 'B',
    href: 'https://example.org/b',
    external: true,
    appearance: 'default' as const,
  }

  it('lists each source once, in order, leaving out the missing ones', () => {
    expect(uniqueSources([a, null, b, { ...a, label: 'A again' }, undefined])).toEqual([a, b])
  })
})

describe('assumedNote (#1121)', () => {
  it('says an earlier year’s home value is assumed to have changed as the average home did', () => {
    expect(assumedNote([year(2026, {}), year(2027, {})])).toBe(
      'Your home’s 2026 value is assumed to have changed as the average home’s did.',
    )
    expect(assumedNote([year(2025, {}), year(2026, {}), year(2027, {})])).toContain('2025 and 2026')
  })

  it('is nothing for one year', () => {
    expect(assumedNote([year(2027, {})])).toBeNull()
  })
})
