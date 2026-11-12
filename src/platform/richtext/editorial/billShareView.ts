import {
  BILL_BODY_NAMES,
  type BillBody,
  type BillPart,
  type BillShare as Bill,
} from '@/platform/lib/billShare'
import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ShareSlice } from '@/platform/ui/ShareBill'

/** The slices in the order the bar and the receipt show them: the City first */
const SLICE_ORDER: readonly BillBody[] = ['city', 'schools', 'county', 'matc']

/** A slice's tone: the City highlighted, the others three grays, the schools' the lightest */
const TONE: Record<BillBody, ShareSlice['tone']> = {
  schools: 'light',
  city: 'highlight',
  county: 'medium',
  matc: 'strong',
}

export type Receipt = {
  /** The bar's slices and the receipt's rows, City first; none until every body has a rate */
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
                amount: formatWholeDollars(found.amount ?? 0),
                percent: found.percent ?? 0,
                share: found.share ?? 0,
                tone: TONE[key],
              },
            ]
          : []
      })
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
