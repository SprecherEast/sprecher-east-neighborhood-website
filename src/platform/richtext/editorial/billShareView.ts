import {
  BILL_BODY_NAMES,
  BILL_BODY_SHORT_NAMES,
  type BillBody,
  type BillPart,
  type BillShare as Bill,
} from '@/platform/lib/billShare'
import type { Certainty } from '@/platform/lib/certainty'
import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ShareSlice } from '@/platform/ui/ShareBill'
import { BILL_BODY_TONES } from '@/platform/ui/shareTones'

/** The order of two bodies with the same share: the City first, the one a reader knows (#1202) */
const SLICE_ORDER: readonly BillBody[] = ['city', 'schools', 'county', 'matc']

export type Receipt = {
  /** The receipt's rows, the largest share first; none until every body has a rate (#1202) */
  slices: ShareSlice[]
  /** The line under the rows, or null when the bill is not whole */
  total: { label: string; amount: string } | null
  /** What the bar shows, for screen readers */
  label: string
  /** The one sentence a screen reader hears when the bill changes */
  summary: string
}

const NOTHING: Receipt = { slices: [], total: null, label: '', summary: '' }

/**
 * What the whole bill shows for a home value (#1035, #1111): the bar's slices and the receipt
 * under it, and the sentence for screen readers. Pure, so the card only draws what it is given.
 */
export function receiptFor(bill: Bill | null, homeValue: number | null): Receipt {
  if (!bill || homeValue === null) return NOTHING
  const home = formatWholeDollars(homeValue)
  const part = (key: BillBody): BillPart | undefined => bill.parts.find((p) => p.key === key)
  const whole = bill.complete && bill.total !== null
  const slices: ShareSlice[] = bill.complete
    ? SLICE_ORDER.flatMap((key) => {
        const found = part(key)
        return found
          ? [
              {
                key,
                name: BILL_BODY_NAMES[key],
                shortName: BILL_BODY_SHORT_NAMES[key],
                amount: formatWholeDollars(found.amount ?? 0),
                percent: found.percent ?? 0,
                share: found.share ?? 0,
                tone: BILL_BODY_TONES[key],
              },
            ]
          : []
      })
        // Stable, so equal shares keep SLICE_ORDER; follows the amounts for every year and home value
        .sort((a, b) => b.share - a.share)
    : []
  return {
    slices,
    total:
      whole && bill.total !== null
        ? { label: 'Total property tax', amount: formatWholeDollars(bill.total) }
        : null,
    label:
      slices.length > 0
        ? `Your whole property tax bill: ${slices.map((s) => `${s.name} ${s.amount}, ${s.percent}%`).join('; ')}`
        : '',
    summary:
      whole && bill.total !== null
        ? `If your home is worth ${home}, your whole bill is about ${formatWholeDollars(bill.total)}.`
        : `The City’s part of a ${home} home’s bill would be about ${formatWholeDollars(part('city')?.amount ?? 0)}.`,
  }
}

/** The status badge a panel shows: the year's own words, with the "not final" look */
export type StatusBadge = { certainty: Certainty; label?: string }

/** The Estimate tag, one for every panel it shows on (#1417) */
export const ESTIMATE_BADGE: StatusBadge = { certainty: 'estimate' }

/**
 * The rates panel's Estimate tag (#1111, #1417): there only for a year whose rates are not all
 * final, that is, one with a stored note ("Proposed") or one that uses an earlier year's rate for
 * some body (`carried`, which a block saved with no note still has); a year with the City's own
 * final rates has nothing to flag. The City tax card and the whole bill always show the tag, so they take
 * `ESTIMATE_BADGE` directly.
 */
export function ratesBadgeFor(note: string | undefined, carried: boolean): StatusBadge | null {
  return carried || note?.trim() ? ESTIMATE_BADGE : null
}
