import { Check, CircleDashed, HelpCircle } from 'lucide-react'
import React from 'react'

import { CERTAINTY_LABELS, type Certainty } from '@/platform/lib/certainty'
import { Badge, type BadgeProps } from '@/platform/ui/Badge'
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
 */
export function FactCard({ fact }: { fact: KeyFact }) {
  const { Icon } = FACT_ICONS[fact.icon]
  return (
    <Card variant="muted" padding="sm" className="flex flex-col gap-2">
      <dl className="flex flex-col gap-1">
        <dt className="flex items-start gap-2 text-sm leading-snug text-muted-foreground">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{fact.label}</span>
        </dt>
        <dd className="text-2xl leading-tight font-bold [overflow-wrap:anywhere] text-foreground">
          {fact.value}
        </dd>
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

const BADGE: Record<Certainty, { variant: BadgeProps['variant']; Icon: typeof Check }> = {
  confirmed: { variant: 'category', Icon: Check },
  estimate: { variant: 'caution', Icon: CircleDashed },
  unknown: { variant: 'neutral', Icon: HelpCircle },
}

function CertaintyBadge({ certainty }: { certainty: Certainty }) {
  const { variant, Icon } = BADGE[certainty]
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {CERTAINTY_LABELS[certainty]}
    </Badge>
  )
}
