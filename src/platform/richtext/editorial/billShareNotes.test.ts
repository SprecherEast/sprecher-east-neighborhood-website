import { describe, expect, it } from 'vitest'

import type { BillShareYear } from './billShare'
import {
  fillNote,
  joinNames,
  notesFor,
  uniqueSources,
  validateNoteBlanks,
  type BillNote,
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

const note = (when: BillNote['when'], text: string, link: BillNote['link'] = null): BillNote => ({
  when,
  text,
  link,
})

describe('joinNames', () => {
  it('writes a list the way a neighbor would say it', () => {
    expect(joinNames([])).toBe('')
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A and B')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C')
  })
})

describe('fillNote', () => {
  it('fills the blanks it knows and leaves {link}, and any other blank, for the page', () => {
    expect(fillNote('Uses {year} rates. See {link} {other}.', { year: '2027' })).toBe(
      'Uses 2027 rates. See {link} {other}.',
    )
  })
})

describe('notesFor (#1158): the words are the editor’s, the code decides which apply', () => {
  const context = (yearIndex: number, missing: string[] = []) => ({
    years: YEARS,
    yearIndex,
    missing,
  })

  it('shows an "always" note in every year, with the year filled in, and in the editor’s order', () => {
    const notes = [note('always', 'First.'), note('always', 'Uses {year} rates.')]
    expect(notesFor(notes, context(1)).map((n) => n.text)).toEqual(['First.', 'Uses 2027 rates.'])
    expect(notesFor(notes, context(0)).map((n) => n.text)).toEqual(['First.', 'Uses 2026 rates.'])
  })

  it('shows an earlier-years note only with more than one year, naming the earlier ones', () => {
    const notes = [note('earlierYears', 'We assume your {years} value moved.')]
    expect(notesFor(notes, context(1))[0]?.text).toBe('We assume your 2026 value moved.')
    const three = [year(2025, ALL), year(2026, ALL), year(2027, ALL)]
    expect(notesFor(notes, { years: three, yearIndex: 2, missing: [] })[0]?.text).toContain(
      '2025 and 2026',
    )
    expect(notesFor(notes, { years: [year(2027, ALL)], yearIndex: 0, missing: [] })).toEqual([])
  })

  it('shows a proposed-rate note only in a year that borrows a rate, and keeps its room in the others', () => {
    const notes = [note('proposedRate', 'The City’s {year} rate is proposed.')]
    expect(notesFor(notes, context(1))).toEqual([
      expect.objectContaining({ text: 'The City’s 2027 rate is proposed.', shown: true }),
    ])
    // 2026 has every rate, so the note is hidden but worded for the year that has it
    expect(notesFor(notes, context(0))).toEqual([
      expect.objectContaining({ text: 'The City’s 2027 rate is proposed.', shown: false }),
    ])
  })

  it('has no room to keep when no year borrows a rate', () => {
    const years = [year(2026, ALL), year(2027, ALL)]
    expect(
      notesFor([note('proposedRate', 'Proposed.')], { years, yearIndex: 1, missing: [] }),
    ).toEqual([])
  })

  it('shows a missing-rates note only when a rate is missing, naming the bodies', () => {
    const notes = [note('missingRates', '{bodies} have no rates.')]
    expect(notesFor(notes, context(1, ['Dane County', 'MATC']))[0]?.text).toBe(
      'Dane County and MATC have no rates.',
    )
    expect(notesFor(notes, context(1))).toEqual([])
  })

  it('hands the note’s link to the page', () => {
    const link = {
      label: 'send a note',
      href: '/contact',
      external: false,
      appearance: 'default' as const,
    }
    expect(notesFor([note('always', 'Please {link}.', link)], context(1))[0]?.link).toEqual(link)
  })

  it('shows nothing when the editor has no notes', () => {
    expect(notesFor([], context(1))).toEqual([])
  })
})

describe('validateNoteBlanks', () => {
  const link = { linkLabel: 'send a note', linkUrl: '/contact' }

  it('accepts a note with no blanks, or the ones its condition allows', () => {
    expect(validateNoteBlanks('Plain words.', { showWhen: 'always' })).toBe(true)
    expect(validateNoteBlanks('Uses {year} rates.', { showWhen: 'always' })).toBe(true)
    expect(validateNoteBlanks('Your {years} value.', { showWhen: 'earlierYears' })).toBe(true)
    expect(validateNoteBlanks('{bodies} have none.', { showWhen: 'missingRates' })).toBe(true)
  })

  it('refuses a blank the condition cannot fill, and one that does not exist, saying what is allowed', () => {
    expect(validateNoteBlanks('Your {years} value.', { showWhen: 'always' })).toMatch(
      /\{years\} can’t be used.*\{year\}, \{link\}/,
    )
    expect(validateNoteBlanks('{nope}', { showWhen: 'always' })).toMatch(/\{nope\} can’t be used/)
  })

  it('wants a link where {link} is written, and {link} where a link is given', () => {
    expect(validateNoteBlanks('Please {link}.', { showWhen: 'always' })).toMatch(
      /Add the link text/,
    )
    expect(validateNoteBlanks('Please write.', { showWhen: 'always', ...link })).toMatch(
      /Write \{link\}/,
    )
    expect(validateNoteBlanks('Please {link}.', { showWhen: 'always', ...link })).toBe(true)
  })

  it('treats a note with no condition as "always"', () => {
    expect(validateNoteBlanks('Uses {year}.', {})).toBe(true)
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
