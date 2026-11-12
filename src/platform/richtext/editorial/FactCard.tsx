import React from 'react'

import { CERTAINTY_LABELS } from '@/platform/lib/certainty'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Card } from '@/platform/ui/Card'
import { Link } from '@/platform/ui/Link'
import { SUBGRID_FOUR_ROWS, SUBGRID_THREE_ROWS } from '@/platform/ui/layoutSizes'

import { FilledText } from './BillFigures.client'
import { FACT_ICONS } from './factIcons'
import type { KeyFact } from './keyFacts'

/**
 * One fact as a small card (#509, #660, #674): the icon beside what the fact is about, in bold
 * body-size text, on the first row; the big short value under it; an optional one-line
 * explanation; then how sure we are in words and the source. The same order on screen and for
 * screen readers (`dt`, then `dd`s). The icon sits inside the `dt`, decorative, and aligned to the
 * label's first line so a label that wraps doesn't centre it awkwardly. Drawn here so the key
 * facts row and any later block that shows a fact look the same.
 *
 * `variant="tab"` (#664, #1112) is the face of a tab button: only the label shows, in phrasing
 * elements, since the tab button is the box (its border, selected state and focus ring), and with
 * no link, because a link can't sit inside a button. The tab's figure and how sure we are are
 * visually hidden text after the label, so screen readers still hear them from the button; the open
 * panel shows both (`FactTabs`). With a `tabId`, `{yearly}` and `{monthly}` in the figure follow
 * the tab's whole tax bill (#1029).
 */
export function FactCard({
  fact,
  variant = 'card',
  tabId,
}: {
  fact: KeyFact
  variant?: 'card' | 'tab'
  /** The tab this button opens, so a `{yearly}` in its figure follows the tab's whole bill (#1029) */
  tabId?: string
}) {
  if (variant === 'tab') {
    return (
      <>
        <span data-fact-part="label">{fact.label}</span>
        <span data-fact-part="spoken" className="sr-only">
          : {tabId ? <FilledText tab={tabId} text={fact.value} /> : fact.value}.{' '}
          {CERTAINTY_LABELS[fact.certainty]}.
        </span>
      </>
    )
  }
  const { Icon } = FACT_ICONS[fact.icon]
  return (
    <Card variant="muted" padding="sm" className={SUBGRID_FOUR_ROWS}>
      <dl className={SUBGRID_THREE_ROWS}>
        <dt className="flex items-start gap-2 text-base leading-snug font-semibold text-foreground">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{fact.label}</span>
        </dt>
        <dd className="mt-1 block text-2xl leading-tight font-bold [overflow-wrap:anywhere] text-foreground">
          {fact.value}
        </dd>
        {fact.detail && (
          <dd className="mt-1 block text-sm leading-snug [overflow-wrap:anywhere] text-muted-foreground">
            {fact.detail}
          </dd>
        )}
      </dl>
      {/* The foot is its own row: the badges of a row's cards share a line, and the row is as tall
          as its tallest foot */}
      <div
        data-fact-part="foot"
        className="mt-2 flex flex-wrap content-start items-center gap-x-3 gap-y-1 pt-1"
      >
        <CertaintyBadge certainty={fact.certainty} />
        {fact.source && (
          <Link href={fact.source.href} external={fact.source.external} className="text-sm">
            {fact.source.label}
          </Link>
        )}
      </div>
    </Card>
  )
}
