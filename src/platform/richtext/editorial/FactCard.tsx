import React from 'react'

import { cn } from '@/platform/lib/cn'
import { joinLastWords } from '@/platform/lib/joinLastWords'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Card } from '@/platform/ui/Card'
import { Link } from '@/platform/ui/Link'
import { SUBGRID_FOUR_ROWS, SUBGRID_THREE_ROWS } from '@/platform/ui/layoutSizes'

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
 * `variant="tab"` (#664) is the same fact as the face of a tab button: the same rows, but in
 * phrasing elements with no card, since the tab button is the box (its border, selected state and
 * focus ring), and with no link, because a link can't sit inside a button. The source link is
 * drawn by whoever shows the tab's panel. A tab has the same parts for every fact (#707): the
 * explanation is left to the open panel, so one fact having one doesn't make its tab fuller than
 * the rest. The icon sits on its own line with the label under it, all left-aligned (#856), so a
 * short label fits four to a row. On a phone (#704) the certainty is left to screen readers
 * (`sr-only`) and the open panel shows it in a line. The figure keeps its last two words together,
 * so "+$90 a year" wraps as "+$90" over "a year".
 */
export function FactCard({ fact, variant = 'card' }: { fact: KeyFact; variant?: 'card' | 'tab' }) {
  const { Icon } = FACT_ICONS[fact.icon]
  const tab = variant === 'tab'
  const Facts = tab ? 'span' : 'dl'
  const Label = tab ? 'span' : 'dt'
  const Value = tab ? 'span' : 'dd'
  const Foot = tab ? 'span' : 'div'
  // A tab leaves how sure we are to screen readers: the open panel shows it once, beside its heading (#980)
  const phoneHidden = tab ? 'sr-only' : ''
  const body = (
    <>
      <Facts className={SUBGRID_THREE_ROWS}>
        <Label
          className={cn(
            'flex gap-2 leading-snug font-semibold text-foreground',
            tab
              ? 'flex-col items-start gap-1 text-xs min-[400px]:text-sm sm:text-base'
              : 'items-start text-base',
          )}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span
            className={cn(
              'min-w-0',
              tab ? 'text-left text-balance break-words' : '[overflow-wrap:anywhere]',
            )}
          >
            {fact.label}
          </span>
        </Label>
        <Value
          data-fact-part="value"
          className={cn(
            'mt-1 block leading-tight font-bold [overflow-wrap:anywhere] text-foreground',
            tab
              ? 'text-left text-xs min-[360px]:text-sm min-[400px]:text-base sm:text-xl lg:text-2xl'
              : 'text-2xl',
          )}
        >
          {tab ? joinLastWords(fact.value) : fact.value}
        </Value>
        {!tab && fact.detail && (
          <Value className="mt-1 block text-sm leading-snug [overflow-wrap:anywhere] text-muted-foreground">
            {fact.detail}
          </Value>
        )}
      </Facts>
      {/* The foot is its own row: the badges of a row's cards share a line, and the row is as tall
          as its tallest foot */}
      <Foot
        data-fact-part="foot"
        className={cn(
          'mt-2 flex flex-wrap content-start items-center gap-x-3 gap-y-1 pt-1',
          phoneHidden,
        )}
      >
        <CertaintyBadge certainty={fact.certainty} />
        {!tab && fact.source && (
          <Link href={fact.source.href} external={fact.source.external} className="text-sm">
            {fact.source.label}
          </Link>
        )}
      </Foot>
    </>
  )
  if (tab) return <span className={SUBGRID_FOUR_ROWS}>{body}</span>
  return (
    <Card variant="muted" padding="sm" className={SUBGRID_FOUR_ROWS}>
      {body}
    </Card>
  )
}
