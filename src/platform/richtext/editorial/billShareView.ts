import {
  BILL_BODY_CAPTIONS,
  BILL_BODY_NAMES,
  type BillBody,
  type BillPart,
  type BillShare as Bill,
} from '@/platform/lib/billShare'
import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { SharePieSlice } from '@/platform/ui/SharePie.client'

/** The slices in the order the pie and the receipt show them: the City first */
const SLICE_ORDER: readonly BillBody[] = ['city', 'schools', 'county', 'matc']

/** A wedge's tone: the City highlighted, the others three grays, the schools' the lightest */
const TONE: Record<BillBody, SharePieSlice['tone']> = {
  schools: 'light',
  city: 'highlight',
  county: 'medium',
  matc: 'dark',
}

export type Receipt = {
  /** The pie's wedges and the receipt's rows, City first; none until every body has a rate */
  slices: SharePieSlice[]
  /** The line under the rows, or null when the bill is not whole */
  total: { label: string; amount: string } | null
  /** The line above the rows: the home the amounts are for, in words and then the amount */
  heading: { lead: string; value: string } | null
  /** What the pie shows, for screen readers */
  label: string
  /** The one sentence a screen reader hears when the bill changes */
  summary: string
}

const NOTHING: Receipt = { slices: [], total: null, heading: null, label: '', summary: '' }

/**
 * What the whole-bill picture shows for a home value (#1035): the pie's slices and the receipt
 * around them, and the sentence for screen readers. Pure, so the card only draws what it is given.
 */
export function receiptFor(bill: Bill | null, homeValue: number | null): Receipt {
  if (!bill || homeValue === null) return NOTHING
  const home = formatWholeDollars(homeValue)
  const part = (key: BillBody): BillPart | undefined => bill.parts.find((p) => p.key === key)
  const whole = bill.complete && bill.total !== null
  const slices: SharePieSlice[] = bill.complete
    ? SLICE_ORDER.flatMap((key) => {
        const found = part(key)
        return found
          ? [
              {
                key,
                name: BILL_BODY_NAMES[key],
                caption: BILL_BODY_CAPTIONS[key],
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
    heading: slices.length > 0 ? { lead: 'For a home valued at', value: home } : null,
    label:
      slices.length > 0
        ? `Your rough property tax: ${slices.map((s) => `${s.name} ${s.amount}, ${s.percent}%`).join('; ')}`
        : '',
    summary:
      whole && bill.total !== null
        ? `If your home is worth ${home}, your whole bill is about ${formatWholeDollars(bill.total)}.`
        : `The City’s part of a ${home} home’s bill would be about ${formatWholeDollars(part('city')?.amount ?? 0)}.`,
  }
}
