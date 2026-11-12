import React from 'react'

import type { Certainty } from '@/platform/lib/certainty'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { increaseLine } from './billFigures'

/**
 * The answer a neighbor came for (#1111, #1118), right under the Rough Estimator. Its top row has
 * the label on the left ("City tax on an average home", or "on your home" after an estimate) and
 * the status badge on the right. Under it the City's tax on the home last estimated in the year
 * chosen is the biggest text on the tab, with a small "a year", then the City's increase in the
 * estimator's accent, orange (`increaseLine`, the same figures a tab's `{yearly}` and `{monthly}` use, so they
 * always agree) and one small sentence with the home value used and the City's share of the whole
 * bill. The badge is the chosen year's stored note, with the "not final" look, or, when the year has
 * none, the tab's stored certainty, so it can never disagree with the year. The increase line keeps
 * its room when there is no figure, so the card never changes height. It draws what it is given.
 */
export function BillAnswer({
  tax,
  increase,
  certainty,
  note,
  yours,
  home,
  cityPercent,
}: {
  /** The City's tax, formatted */
  tax: string
  /** What the City's tax rises by in the year, in whole dollars; null when the tab's chart cannot say */
  increase: number | null
  /** How sure we are about the tab's fact; the badge unless the chosen year has a note */
  certainty?: Certainty
  /** The chosen year's stored note, such as "proposed"; empty for none */
  note?: string
  /** Whether the home is one the reader estimated, not the City's average */
  yours: boolean
  /** The home value used, formatted */
  home: string
  /** The City's whole percent of the whole bill; null while the bill is not whole */
  cityPercent: number | null
}) {
  const noted = note ? `${note.charAt(0).toUpperCase()}${note.slice(1)}` : undefined
  const badge = noted ? 'estimate' : certainty
  return (
    <Card as="section" variant="elevated" padding="xs" aria-label="Your City tax">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <Text
            variant="small"
            as="p"
            className="text-xs font-semibold whitespace-nowrap text-foreground"
          >
            {yours ? 'City tax on your home' : 'City tax on an average home'}
          </Text>
          {badge && (
            <span className="ml-auto shrink-0">
              <CertaintyBadge certainty={badge} label={noted} size="xs" />
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <Text variant="figure" as="span">
            {tax}
          </Text>
          <Text variant="small" as="span">
            a year
          </Text>
        </div>
        <Text variant="small" as="p" className="min-h-5 font-semibold">
          <span data-answer-increase className="text-accent-strong">
            {increase === null ? '' : increaseLine(increase)}
          </span>
        </Text>
        <Text variant="small" as="p" className="leading-snug">
          {cityPercent === null
            ? `${yours ? 'Your' : 'Average'} home: ${home}.`
            : `${yours ? 'Your' : 'Average'} home: ${home}. The City is ${cityPercent}% of the whole bill.`}
        </Text>
      </div>
    </Card>
  )
}
