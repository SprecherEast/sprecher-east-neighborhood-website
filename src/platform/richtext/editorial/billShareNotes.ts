import type { ResolvedLink } from '@/platform/lib'
import { fillFromEarlier } from '@/platform/lib/billShare'

import type { BillShareYear } from './billShare'

/** "A, B and C" */
export const joinNames = (names: string[]) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

/**
 * When a note shows. The wording is the editor's (the block's `notes` field); the code only decides
 * whether a note applies in the year shown, and fills in its blanks.
 */
export const NOTE_CONDITIONS = ['always', 'earlierYears', 'proposedRate', 'missingRates'] as const
export type NoteCondition = (typeof NOTE_CONDITIONS)[number]

export const NOTE_CONDITION_LABELS: Record<NoteCondition, string> = {
  always: 'Always',
  earlierYears: 'When the tab has more than one year',
  proposedRate: 'In a year with a proposed rate',
  missingRates: 'When a rate is missing, so the whole bill can’t be shown',
}

/** The blanks an editor may write in a note: what each one becomes, and for which conditions */
export const NOTE_BLANKS: Record<string, { meaning: string; only?: NoteCondition }> = {
  year: { meaning: 'the year shown' },
  link: { meaning: 'the note’s link, from the link text and address' },
  years: { meaning: 'the earlier years', only: 'earlierYears' },
  bodies: { meaning: 'the bodies with no rate', only: 'missingRates' },
}

/** A note, as the picture draws it: plain data, so it renders without a CMS (decision 0013) */
export type BillNote = { text: string; when: NoteCondition; link: ResolvedLink | null }

/** The year's notes: shown now, or kept as room so an open row never changes height */
export type ShownNote = { key: string; text: string; link: ResolvedLink | null; shown: boolean }

/** What the code knows when it decides which notes apply */
export type NoteContext = {
  years: readonly BillShareYear[]
  yearIndex: number
  /** The names of the bodies with no rate to use in the year shown */
  missing: readonly string[]
}

const BLANK = /\{(\w+)\}/g

/** Fills the blanks a note's condition knows about; `{link}` stays for the page to draw */
export const fillNote = (text: string, values: Record<string, string>) =>
  text.replace(BLANK, (blank, name: string) => values[name] ?? blank)

/** The values a note has in the year at `index`, or null when its condition does not apply there */
function valuesIn(
  when: NoteCondition,
  years: readonly BillShareYear[],
  index: number,
  missing: readonly string[],
): Record<string, string> | null {
  const year = years[index]
  if (!year) return null
  const values = { year: String(year.year) }
  switch (when) {
    case 'always':
      return values
    case 'earlierYears':
      return years.length < 2
        ? null
        : { ...values, years: joinNames(years.slice(0, -1).map((earlier) => String(earlier.year))) }
    case 'proposedRate': {
      const earlier = years[index - 1]
      if (!earlier) return null
      return fillFromEarlier(year.rates, earlier.rates).filled.length === 0 ? null : values
    }
    case 'missingRates':
      return missing.length === 0 ? null : { ...values, bodies: joinNames([...missing]) }
  }
}

/**
 * The notes for the year shown, in the editor's order. A note about a proposed rate that does not
 * apply in this year keeps its room, worded for the first year that has one and hidden from
 * everyone, so the open row never changes height when a year is chosen.
 */
export function notesFor(notes: readonly BillNote[], context: NoteContext): ShownNote[] {
  const { years, yearIndex, missing } = context
  return notes.flatMap((note, position): ShownNote[] => {
    const key = `note-${position}`
    const now = valuesIn(note.when, years, yearIndex, missing)
    if (now) return [{ key, text: fillNote(note.text, now), link: note.link, shown: true }]
    if (note.when !== 'proposedRate') return []
    for (let index = 0; index < years.length; index++) {
      const kept = valuesIn(note.when, years, index, missing)
      if (kept) return [{ key, text: fillNote(note.text, kept), link: note.link, shown: false }]
    }
    return []
  })
}

/** The sources a tab lists, each once: the same link given twice (the tab's and a year's) shows once */
export function uniqueSources(
  sources: readonly (ResolvedLink | null | undefined)[],
): ResolvedLink[] {
  const seen = new Set<string>()
  return sources.flatMap((source) => {
    if (!source || seen.has(source.href)) return []
    seen.add(source.href)
    return [source]
  })
}

/** The blanks a note's text uses, in order */
const blanksIn = (text: string) => Array.from(text.matchAll(BLANK), (match) => match[1] ?? '')

type NoteSiblings = {
  showWhen?: NoteCondition | null
  linkLabel?: string | null
  linkUrl?: string | null
}

/**
 * Refuses a note whose blanks the editor cannot use with its condition, whose `{link}` has no
 * link, or whose link has no `{link}` to stand in. The reason shows under the field.
 */
export function validateNoteBlanks(text: string, siblings: NoteSiblings): true | string {
  const { showWhen = 'always', linkLabel, linkUrl } = siblings
  for (const name of blanksIn(text)) {
    const blank = NOTE_BLANKS[name]
    if (!blank || (blank.only && blank.only !== showWhen)) {
      const usable = Object.entries(NOTE_BLANKS)
        .filter(([, known]) => !known.only || known.only === showWhen)
        .map(([known]) => `{${known}}`)
        .join(', ')
      return `{${name}} can’t be used in this note. Use ${usable}.`
    }
  }
  const hasLink = Boolean(linkLabel?.trim() && linkUrl?.trim())
  const hasBlank = blanksIn(text).includes('link')
  if (hasBlank && !hasLink) return 'Add the link text and address for {link}, or take {link} out.'
  if (hasLink && !hasBlank) return 'Write {link} where the link should go in the note.'
  return true
}

/** The explanation shown under a note's text in Admin */
export const NOTE_BLANKS_HELP = `Blanks the page fills in: ${Object.entries(NOTE_BLANKS)
  .map(
    ([name, { meaning, only }]) =>
      `{${name}} is ${meaning}${only ? ' (only with that condition)' : ''}`,
  )
  .join('; ')}.`
