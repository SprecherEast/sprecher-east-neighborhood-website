import {
  BILL_BODIES,
  BILL_BODY_NAMES,
  BILL_BODY_SHORT_NAMES,
  type BillBody,
  type MillRates,
} from '@/platform/lib/billShare'

import type { BillShareYear } from './billShare'
import { fillNote } from './billShareNotes'

/** One body's line in the rates panel: the rate it has in the year shown, and the year that rate is from */
export type RateLine = {
  key: BillBody
  name: string
  /** The start of `name` the narrowest phones show, where the whole name would not fit (the bill's own short form) */
  shortName?: string
  /** The rate as a percent of value ("0.868%"); null where the body has no rate to use */
  percent: string | null
  /** The rate in dollars per $1,000 of value ("$8.68"); null where the body has no rate to use */
  perThousand: string | null
  /** The year the rate is from: the year shown, or the year before for a body that has not set its own */
  year: number
  /** Whether the rate is the year before's, so the bill mixes two years */
  carried: boolean
}

const validRate = (rate: number | undefined): rate is number =>
  typeof rate === 'number' && Number.isFinite(rate) && rate > 0

/**
 * The rates the bill uses in the year at `index`, one line per body in the bill's order. It follows
 * the same rule as the bill (`fillFromEarlier`): a body with no rate of its own that year uses the
 * year before's, and the line says whose year it is. A body with no rate in either keeps its line,
 * with no figures, so the panel is as tall in every year. While the year counts (#1370), `shown` holds
 * the rates the bill is using at that moment: the figures are written from them, and the year and
 * "carried" labels stay the year chosen's.
 */
export function rateLinesFor(
  years: readonly BillShareYear[],
  index: number,
  shown?: MillRates,
): RateLine[] {
  const year = years[index]
  const earlier = years[index - 1]
  return BILL_BODIES.map((key): RateLine => {
    const own = year?.rates[key]
    const before = earlier?.rates[key]
    const carried = !validRate(own) && validRate(before)
    const settled = validRate(own) ? own : carried ? before : null
    const counting = shown?.[key]
    const rate = settled !== null && validRate(counting) ? counting : settled
    return {
      key,
      name: BILL_BODY_NAMES[key],
      shortName: BILL_BODY_SHORT_NAMES[key],
      percent: rate === null ? null : `${(rate / 10).toFixed(3)}%`,
      perThousand: rate === null ? null : `$${rate.toFixed(2)}`,
      year: carried && earlier ? earlier.year : (year?.year ?? 0),
      carried,
    }
  })
}

/**
 * The note under the rates panel, the editor's wording with `{year}` filled in, for the first year
 * that carries a rate over from the one before. It shows in that year and any other that does; in
 * a year that carries none it keeps its room, hidden, so the panel is as tall in every year (the
 * same rule as the notes in `notesFor`). Null when no year carries a rate, or the editor wrote no
 * note.
 */
export function ratesNoteFor(
  years: readonly BillShareYear[],
  yearIndex: number,
  template: string,
): { text: string; shown: boolean } | null {
  if (!template.trim()) return null
  const carries = (index: number) => rateLinesFor(years, index).some((line) => line.carried)
  const first = years.findIndex((_, index) => carries(index))
  const year = years[first]
  if (!year) return null
  return { text: fillNote(template, { year: String(year.year) }), shown: carries(yearIndex) }
}
