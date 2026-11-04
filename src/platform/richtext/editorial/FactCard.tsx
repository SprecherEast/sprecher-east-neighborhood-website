import React from 'react'

import { cn } from '@/platform/lib/cn'
import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Card } from '@/platform/ui/Card'
import { Link } from '@/platform/ui/Link'

import { FACT_ICONS } from './factIcons'
import type { KeyFact } from './keyFacts'

/**
 * One fact as a small card (#509, #660): the icon beside what the fact is on the first row, the
 * big short value under it, then how sure we are in words and the source. The label comes before
 * the value in reading order through `dt`/`dd`. The icon sits inside the `dt`, decorative, and
 * aligned to the label's first line so a label that wraps doesn't centre it awkwardly. Drawn here
 * so the key facts row and any later block that shows a fact look the same.
 *
 * `variant="tab"` (#664) is the same fact as the face of a tab button: the same rows, but in
 * phrasing elements with no card, since the tab button is the box (its border, selected state and
 * focus ring), and with no link, because a link can't sit inside a button. The source link is
 * drawn by whoever shows the tab's panel.
 */
export function FactCard({ fact, variant = 'card' }: { fact: KeyFact; variant?: 'card' | 'tab' }) {
  const { Icon } = FACT_ICONS[fact.icon]
  const tab = variant === 'tab'
  const Facts = tab ? 'span' : 'dl'
  const Label = tab ? 'span' : 'dt'
  const Value = tab ? 'span' : 'dd'
  const Foot = tab ? 'span' : 'div'
  const body = (
    <>
      <Facts className="flex flex-col gap-1">
        <Label
          className={cn(
            'flex items-start gap-2 text-sm leading-snug',
            // The selected tab is tinted, where the muted grey is just under 4.5:1
            tab ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{fact.label}</span>
        </Label>
        <Value className="block text-2xl leading-tight font-bold [overflow-wrap:anywhere] text-foreground">
          {fact.value}
        </Value>
      </Facts>
      <Foot className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        <CertaintyBadge certainty={fact.certainty} />
        {!tab && fact.source && (
          <Link href={fact.source.href} external={fact.source.external} className="text-sm">
            {fact.source.label}
          </Link>
        )}
      </Foot>
    </>
  )
  if (tab) return <span className="flex h-full flex-col gap-2">{body}</span>
  return (
    <Card variant="muted" padding="sm" className="flex flex-col gap-2">
      {body}
    </Card>
  )
}
