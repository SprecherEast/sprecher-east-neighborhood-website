import React, { type ReactNode } from 'react'

import type { Certainty } from '@/platform/lib/certainty'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { increaseLine } from './billFigures'
import { statusBadgeFor } from './billShareView'
import { PanelHeader } from './PanelHeader'

/**
 * The answer a neighbor came for (#1111, #1118), right under the Rough Estimator. Its top row has
 * the label on the left ("City tax on an average home", or "on your home" after an estimate) and
 * the status badge on the right. Under it the City's tax on the home last estimated in the year
 * chosen is the biggest text on the tab, with a small "a year", then the City's increase in the
 * estimator's accent, orange (`increaseLine`, the same figures a tab's `{yearly}` and `{monthly}` use, so they
 * always agree) and, while the card shows the City's average home, one small sentence with that
 * home's value and the City's share of the whole bill. After an estimate the sentence is left out:
 * it would only repeat the value the reader typed and a share the whole bill shows (#1183). The badge is the chosen year's stored note, with the "not final" look, or, when the year has
 * none, the tab's stored certainty, so it can never disagree with the year. The increase line keeps
 * its room when there is no figure, so the card never changes height. In the earliest of several
 * years it reads "Base year" in the primary green instead, with the next year's line kept as hidden room (#1135). It draws what it is given.
 */
export function BillAnswer({
  tax,
  increase,
  certainty,
  note,
  yours,
  home,
  cityPercent,
  baseYear = false,
  laterIncrease = null,
  onBadgePress,
  toast,
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
  /** The average home's value, formatted; only shown while `yours` is false */
  home: string
  /** The City's whole percent of the whole bill; null while the bill is not whole */
  cityPercent: number | null
  /** Whether the year is the earliest of several: the line says "Base year", the one the later year is compared with (#1135) */
  baseYear?: boolean
  /** In the base year: the next year's increase, whose line is kept as hidden room so the card is as tall in both years */
  laterIncrease?: number | null
  /** Makes the badge a button that says why the figures are an estimate (#1417) */
  onBadgePress?: () => void
  /** A `Toast` placed inside the card, or any toast the page shows for it */
  toast?: ReactNode
}) {
  const badge = statusBadgeFor(certainty, note)
  const homeSentence = `Average home: ${home}.`
  return (
    <Card as="section" variant="elevated" padding="xs" aria-label="Your City tax">
      <div className="space-y-1">
        <PanelHeader badge={badge} onBadgePress={onBadgePress}>
          <Text variant="subsection" as="p">
            {yours ? 'City tax on your home' : 'City tax on an average home'}
          </Text>
        </PanelHeader>
        <div className="flex items-baseline gap-1.5">
          <Text variant="figure" as="span">
            {tax}
          </Text>
          <Text variant="small" as="span">
            a year
          </Text>
        </div>
        <Text variant="small" as="p" className="min-h-5 font-semibold">
          <span className="grid">
            <span
              data-answer-increase
              className={`col-start-1 row-start-1 ${baseYear ? 'text-primary-strong' : 'text-accent-strong'}`}
            >
              {baseYear ? 'Base year' : increase === null ? '' : increaseLine(increase)}
            </span>
            {baseYear && laterIncrease !== null && (
              <span aria-hidden className="invisible col-start-1 row-start-1">
                {increaseLine(laterIncrease)}
              </span>
            )}
          </span>
        </Text>
        {!yours && (
          <Text variant="small" as="p" className="leading-snug">
            {cityPercent === null
              ? homeSentence
              : `${homeSentence} The City is ${cityPercent}% of the whole bill.`}
          </Text>
        )}
      </div>
      {toast}
    </Card>
  )
}
