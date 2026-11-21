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

/**
 * The toast for the year at `index` (#1380): the carried-rates one in a year that uses an earlier
 * year's rate for some body, the own-rates one in a year where every body has its own, each with
 * `{year}` filled in as the year shown. Null where the editor turned that toast off, or the year
 * does not exist.
 */
export function yearToastFor(
  years: readonly BillShareYear[],
  index: number,
  toasts: Record<BillToastId, BillToast | null>,
): { toast: BillToast; message: string } | null {
  const year = years[index]
  if (!year) return null
  const id: BillToastId = rateLinesFor(years, index).some((line) => line.carried)
    ? 'ratesCarried'
    : 'ratesOwn'
  const toast = toasts[id]
  return toast ? { toast, message: fillNote(toast.message, { year: String(year.year) }) } : null
}
