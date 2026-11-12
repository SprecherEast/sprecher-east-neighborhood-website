import React from 'react'

import type { Certainty } from '@/platform/lib/certainty'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { figuresFor } from './billFigures'

/**
 * The answer a neighbor came for (#1111), right under the Rough Estimator: the City's tax on the
 * home last estimated in the year chosen as the biggest text on the tab, the City's increase for a
 * year and for a month under it (`figuresFor`, the same figures a tab's `{yearly}` and `{monthly}`
 * use, so they always agree), how sure we are as one badge, and one small line with the home value
 * used and the City's share of the whole bill. The increase line keeps its room when there is no
 * figure, so the card never changes height. It draws what it is given.
 */
export function BillAnswer({
  year,
  tax,
  increase,
  certainty,
  home,
  cityPercent,
}: {
  year: number
  /** The City's tax, formatted */
  tax: string
  /** What the City's tax rises by in the year, in whole dollars; null when the tab's chart cannot say */
  increase: number | null
  certainty?: Certainty
  /** The home value used, formatted */
  home: string
  /** The City's whole percent of the whole bill; null while the bill is not whole */
  cityPercent: number | null
}) {
  const figures = increase === null ? null : figuresFor(increase)
  return (
    <Card as="section" variant="elevated" padding="sm" aria-label="Your City tax">
      <div className="space-y-1">
        <Text variant="small" as="p" className="font-semibold text-foreground">
          City tax in {year}
        </Text>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Text variant="figure">{tax}</Text>
          {certainty && <CertaintyBadge certainty={certainty} />}
        </div>
        <Text variant="small" as="p" className="min-h-6 font-semibold text-foreground">
          <span data-answer-increase>
            {figures &&
              (increase === 0
                ? 'No increase'
                : `Up ${figures.yearly} a year, ${figures.monthly} a month`)}
          </span>
        </Text>
        <Text variant="small" as="p">
          {cityPercent === null ? `${home} home` : `${home} home · City ${cityPercent}%`}
        </Text>
      </div>
    </Card>
  )
}
