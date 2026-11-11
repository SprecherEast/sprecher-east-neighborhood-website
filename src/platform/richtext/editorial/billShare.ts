import type { ResolvedLink } from '@/platform/lib'
import type { BillShareBlock } from '@/payload-types'
import { BILL_BODIES, type MillRates } from '@/platform/lib/billShare'

import { toEditorialLink } from './editorialLink'

/** The bill split block's fields, as stored */
export type StoredBillShare = Partial<Pick<BillShareBlock, 'intro' | 'years'>>

/** One tax year, as the picture draws it */
export type BillShareYear = {
  year: number
  label: string
  /** The City's average home that year, in dollars: what the box starts with */
  averageHome: number
  /** Net rates per $1,000 of value; a body that has not set its rate is missing */
  rates: MillRates
  source: ResolvedLink | null
}

/** The block's props: plain data, so it renders without a CMS (decision 0013) */
export type BillShareProps = { intro: string; years: BillShareYear[] }

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
        averageHome: row.averageHome,
        rates,
        source: toEditorialLink(row.linkUrl, row.linkLabel),
      },
    ]
  })
  return { intro: stored.intro?.trim() ?? '', years }
}
