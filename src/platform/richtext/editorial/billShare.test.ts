import { describe, expect, it } from 'vitest'

import { toBillShareProps, type StoredBillShare } from './billShare'
import { DEFAULT_BILL_NOTES, DEFAULT_BILL_ROW_TITLES } from './billShareDefaults'
import { NOTE_CONDITIONS } from './billShareNotes'

const stored = (years: Record<string, unknown>[], intro = 'Based on the City’s average home.') =>
  ({ intro, years }) as unknown as StoredBillShare

const year = (extra: Record<string, unknown> = {}) => ({
  year: 2026,
  label: '2026 rates',
  averageHome: 481300,
  schools: 8.6814,
  county: 2.3564,
  matc: 0.6153,
  city: 7.0139,
  linkLabel: 'City tax detail',
  linkUrl: 'https://example.org/tax',
  ...extra,
})

describe('toBillShareProps', () => {
  it('reads each year’s average home, rates and source link', () => {
    const { intro, years } = toBillShareProps(stored([year()]))
    expect(intro).toBe('Based on the City’s average home.')
    expect(years).toHaveLength(1)
    expect(years[0]).toMatchObject({
      year: 2026,
      label: '2026 rates',
      averageHome: 481300,
      rates: { schools: 8.6814, county: 2.3564, matc: 0.6153, city: 7.0139 },
      source: { label: 'City tax detail', href: 'https://example.org/tax' },
    })
  })

  it('reads a year’s note for under its switch, and none when it is empty', () => {
    const { years } = toBillShareProps(
      stored([year({ note: ' proposed ' }), year({ year: 2027, note: '  ' })]),
    )
    expect(years[0]?.note).toBe('proposed')
    expect(years[1]?.note).toBe('')
  })

  it('leaves a rate that is empty out, so the picture says it is not set', () => {
    const { years } = toBillShareProps(
      stored([year({ year: 2027, schools: null, county: undefined, matc: 0, city: 6.93 })]),
    )
    expect(years[0]?.rates).toEqual({ city: 6.93 })
  })

  it('drops a year with no average home or no year, and a bad link', () => {
    const { years } = toBillShareProps(
      stored([year({ averageHome: 0 }), year({ year: null }), year({ linkUrl: 'javascript:x' })]),
    )
    expect(years).toHaveLength(1)
    expect(years[0]?.source).toBeNull()
  })

  it('has no years when nothing is stored', () => {
    expect(toBillShareProps({}).years).toEqual([])
  })
})

describe('toBillShareProps: the row titles and notes are the block’s (#1158)', () => {
  const block = (extra: Record<string, unknown>) =>
    ({ ...stored([year()]), ...extra }) as unknown as StoredBillShare

  it('reads the editor’s titles and notes, in their order, with each note’s condition and link', () => {
    const { rows, notes } = toBillShareProps(
      block({
        rows: {
          breakdown: 'Where it goes',
          differ: 'Why it may differ',
          sources: 'Where we looked',
        },
        notes: [
          { showWhen: 'earlierYears', text: 'Earlier: {years}.' },
          {
            showWhen: 'always',
            text: 'Please {link}.',
            linkLabel: 'write us',
            linkUrl: '/contact',
          },
        ],
      }),
    )
    expect(rows).toEqual({
      breakdown: 'Where it goes',
      differ: 'Why it may differ',
      sources: 'Where we looked',
    })
    expect(notes).toEqual([
      { when: 'earlierYears', text: 'Earlier: {years}.', link: null },
      {
        when: 'always',
        text: 'Please {link}.',
        link: expect.objectContaining({ label: 'write us', href: '/contact' }),
      },
    ])
  })

  it('leaves out a note with no words, and reads an unknown condition as "always"', () => {
    const { notes } = toBillShareProps(
      block({
        notes: [
          { showWhen: 'always', text: '   ' },
          { showWhen: 'sometimes', text: 'Kept.' },
        ],
      }),
    )
    expect(notes).toEqual([{ when: 'always', text: 'Kept.', link: null }])
  })

  it('shows the starting titles and notes for a block stored before they were fields', () => {
    const { rows, notes } = toBillShareProps(stored([year()]))
    expect(rows).toEqual(DEFAULT_BILL_ROW_TITLES)
    expect(notes.map((note) => note.text)).toEqual(DEFAULT_BILL_NOTES.map((note) => note.text))
    expect(notes.at(-1)?.link).toMatchObject({ label: 'send us a note', href: '/contact' })
  })

  it('shows no notes when the editor emptied the list, and a starting title for a blank one', () => {
    const { rows, notes } = toBillShareProps(block({ notes: [], rows: { differ: '  ' } }))
    expect(notes).toEqual([])
    expect(rows.differ).toBe(DEFAULT_BILL_ROW_TITLES.differ)
  })

  it('has a note for every condition the editor can pick', () => {
    expect(new Set(DEFAULT_BILL_NOTES.map((note) => note.showWhen))).toEqual(
      new Set(NOTE_CONDITIONS),
    )
  })
})
