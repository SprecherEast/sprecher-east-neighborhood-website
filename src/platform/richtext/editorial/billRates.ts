import {
  BILL_BODIES,
  BILL_BODY_NAMES,
  BILL_BODY_SHORT_NAMES,
  type BillBody,
  type MillRates,
} from '@/platform/lib/billShare'

import type { BillShareYear } from './billShare'
import { fillNote } from './billShareNotes'
import type { BillToast, BillToastId } from './billToasts'

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

/** The years the rates standing in for missing ones are from in the year at `index`, once each: "2026" */
const carriedYears = (years: readonly BillShareYear[], index: number): string =>
  [
    ...new Set(
      rateLinesFor(years, index)
        .filter((line) => line.carried)
        .map((line) => line.year),
    ),
  ]
    .sort()
    .join(' and ')

/**
 * The toast with this id for the year at `index` (#1380, #1417), with `{year}` filled in as the year
 * shown and `{carried}` as the year the rates standing in for missing ones are from. Null where
 * the editor turned that toast off, or the year does not exist.
 */
export function toastFor(
  id: BillToastId,
  years: readonly BillShareYear[],
  index: number,
  toasts: Record<BillToastId, BillToast | null>,
): { id: BillToastId; toast: BillToast; message: string } | null {
  const year = years[index]
  const toast = toasts[id]
  if (!year || !toast) return null
  const values = { year: String(year.year), carried: carriedYears(years, index) }
  return { id, toast, message: fillNote(toast.message, values) }
}

/**
 * The rates warning the page shows by itself for the year at `index` (#1380): the carried-rates one
 * in a year that uses an earlier year's rate for some body, the own-rates one in a year where every
 * body has its own. Null where the editor turned that toast off, or the year does not exist.
 */
export function yearToastFor(
  years: readonly BillShareYear[],
  index: number,
  toasts: Record<BillToastId, BillToast | null>,
): { id: BillToastId; toast: BillToast; message: string } | null {
  const carried = rateLinesFor(years, index).some((line) => line.carried)
  return toastFor(carried ? 'ratesCarried' : 'ratesOwn', years, index, toasts)
}

/**
 * The rates panel's title for the year at `index` (#1417): the City's rate while the other bodies'
 * rates are an earlier year's, the year's rates once every one is its own. `{year}` is the year shown.
 */
export function ratesTitleFor(
  years: readonly BillShareYear[],
  index: number,
  text: { title: string; carriedTitle: string },
): string {
  const carried = rateLinesFor(years, index).some((line) => line.carried)
  return fillNote(carried ? text.carriedTitle : text.title, {
    year: String(years[index]?.year ?? ''),
  })
}
