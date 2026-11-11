import type { BillBody } from '@/platform/lib/billShare'
import type { ShareBarSlice } from '@/platform/ui/ShareBar.client'
import type { SharePieSlice } from '@/platform/ui/SharePie.client'

/** The bar's order, as it always was: the schools, the City (the highlighted slice), the county, the college */
const BAR_ORDER: readonly BillBody[] = ['schools', 'city', 'county', 'matc']

/** A slice's tone in the bar, in the same lightness order as the pie's wedges */
const BAR_TONE: Record<BillBody, ShareBarSlice['tone']> = {
  schools: 'light',
  city: 'highlight',
  county: 'medium',
  matc: 'strong',
}

/**
 * The whole bill as one bar (#1030), made from the pie's own slices, so the bar and the pie always
 * show the same shares for the same home and year. The City's slice says what it is, name first and
 * then the number, as the page's other lines do. Nothing until the bill is whole.
 */
export function shareBarFor(slices: SharePieSlice[]): { slices: ShareBarSlice[]; label: string } {
  const bars = BAR_ORDER.flatMap((key): ShareBarSlice[] => {
    const slice = slices.find((candidate) => candidate.key === key)
    return slice
      ? [
          {
            key,
            share: slice.share,
            tone: BAR_TONE[key],
            label: `${slice.percent}%`,
            ...(key === 'city' ? { name: 'City tax' } : {}),
          },
        ]
      : []
  })
  const names = bars.flatMap((bar) => {
    const slice = slices.find((candidate) => candidate.key === bar.key)
    return slice ? [`${slice.name} ${slice.percent}%`] : []
  })
  return { slices: bars, label: `Your whole property tax bill: ${names.join(', ')}` }
}
