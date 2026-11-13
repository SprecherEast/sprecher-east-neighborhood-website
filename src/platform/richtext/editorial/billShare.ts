import type { ResolvedLink } from '@/platform/lib'
import type { BillShareBlock } from '@/payload-types'
import { BILL_BODIES, type MillRates } from '@/platform/lib/billShare'

import { DEFAULT_BILL_NOTES, DEFAULT_BILL_ROW_TITLES } from './billShareDefaults'
import { NOTE_CONDITIONS, type BillNote } from './billShareNotes'
import { toEditorialLink } from './editorialLink'

/** A tab shows one whole tax bill: a second would be hidden, so the editor and the tag refuse it */
export const BILL_SHARE_ONCE_MESSAGE = 'Add the whole tax bill once per tab.'
export const hasTooManyBills = (blockTypes: readonly unknown[]) =>
  blockTypes.filter((type) => type === 'billShare').length > 1

/** The bill split block's fields, as stored */
export type StoredBillShare = Partial<Pick<BillShareBlock, 'intro' | 'years' | 'rows' | 'notes'>>

/** One tax year, as the picture draws it */
export type BillShareYear = {
  year: number
  label: string
  /** A word under the year's switch, such as "proposed" until its rates are set; empty for none */
  note: string
  /** The City's average home that year, in dollars: what the box starts with */
  averageHome: number
  /** Net rates per $1,000 of value; a body that has not set its rate is missing */
  rates: MillRates
  source: ResolvedLink | null
}

/** The titles of the three rows under the bill, as the page draws them */
export type BillRowTitles = { breakdown: string; differ: string; sources: string }

/** The block's props: plain data, so it renders without a CMS (decision 0013) */
export type BillShareProps = {
  intro: string
  years: BillShareYear[]
  rows: BillRowTitles
  notes: BillNote[]
}

/**
 * The row titles: each one the editor's, or its starting text while the block has none of its own
 * (a block stored before the titles became fields).
 */
const rowTitlesOf = (stored: StoredBillShare['rows']): BillRowTitles => ({
  breakdown: stored?.breakdown?.trim() || DEFAULT_BILL_ROW_TITLES.breakdown,
  differ: stored?.differ?.trim() || DEFAULT_BILL_ROW_TITLES.differ,
  sources: stored?.sources?.trim() || DEFAULT_BILL_ROW_TITLES.sources,
})

/**
 * The notes: the editor's list, in their order, without a note that has no text. A block with no
 * list shows the starting list: one stored before the notes became fields, and one whose list was
 * emptied in Admin, which does not store an empty list. Only a list written empty through the API
 * shows none.
 */
function notesOf(stored: StoredBillShare['notes']): BillNote[] {
  const rows = Array.isArray(stored) ? stored : DEFAULT_BILL_NOTES
  return rows.flatMap((row): BillNote[] => {
    const text = row.text?.trim()
    if (!text) return []
    const when = NOTE_CONDITIONS.find((condition) => condition === row.showWhen) ?? 'always'
    return [{ text, when, link: toEditorialLink(row.linkUrl, row.linkLabel) }]
  })
}

/**
 * The stored block as the picture's props. A year without a year number, a label or an average
 * home is dropped; a rate that is empty or not above zero is left out, so it reads as not set.
 */
export function toBillShareProps(stored: StoredBillShare): BillShareProps {
  const years = (stored.years ?? []).flatMap((row): BillShareYear[] => {
    const label = row.label?.trim()
    if (!row.year || !label || !(row.averageHome > 0)) return []
    const rates: MillRates = {}
    for (const key of BILL_BODIES) {
      const rate = row[key]
      if (typeof rate === 'number' && rate > 0) rates[key] = rate
    }
    return [
      {
        year: row.year,
        label,
        note: row.note?.trim() ?? '',
        averageHome: row.averageHome,
        rates,
        source: toEditorialLink(row.linkUrl, row.linkLabel),
      },
    ]
  })
  return {
    intro: stored.intro?.trim() ?? '',
    years,
    rows: rowTitlesOf(stored.rows),
    notes: notesOf(stored.notes),
  }
}
