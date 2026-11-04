import React from 'react'

import { CertaintyBadge } from '@/platform/ui/CertaintyBadge'
import { Card } from '@/platform/ui/Card'
import { Link } from '@/platform/ui/Link'

import { FACT_ICONS } from './factIcons'
import type { KeyFact } from './keyFacts'

/**
 * One fact as a small card (#509, #660, #674): the icon beside what the fact is about, in bold
 * body-size text, on the first row; the big short value under it; an optional one-line
 * explanation; then how sure we are in words and the source. The same order on screen and for
 * screen readers (`dt`, then `dd`s). The icon sits inside the `dt`, decorative, and aligned to the
 * label's first line so a label that wraps doesn't centre it awkwardly. Drawn here so the key
 * facts row and any later block that shows a fact look the same.
 */
export function FactCard({ fact }: { fact: KeyFact }) {
  const { Icon } = FACT_ICONS[fact.icon]
  return (
    <Card variant="muted" padding="sm" className="flex flex-col gap-2">
      <dl className="flex flex-col gap-1">
        <dt className="flex items-start gap-2 text-base leading-snug font-semibold text-foreground">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{fact.label}</span>
        </dt>
        <dd className="text-2xl leading-tight font-bold [overflow-wrap:anywhere] text-foreground">
          {fact.value}
        </dd>
        {fact.detail && (
          <dd className="text-sm leading-snug [overflow-wrap:anywhere] text-muted-foreground">
            {fact.detail}
          </dd>
        )}
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
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
