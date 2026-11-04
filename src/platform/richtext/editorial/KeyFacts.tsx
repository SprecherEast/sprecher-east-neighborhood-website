import React from 'react'

import { cn } from '@/platform/lib/cn'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'

import { FactCard } from './FactCard'
import type { KeyFactsProps } from './keyFacts'

/**
 * A row of small fact cards (#509, #660), after the USWDS icon list and summary box: an icon beside
 * what the fact is, a big short value, how sure we are in words, and the source (`FactCard`). In
 * the shared `CardGrid`, a list, so screen readers hear how many facts there are.
 */
export function KeyFacts({ facts, className }: KeyFactsProps & { className?: string }) {
  if (facts.length === 0) return null
  return (
    <CardGrid
      columns={facts.length % 3 === 0 ? 3 : 2}
      gap="sm"
      // Exactly three facts fit three across from `sm`, so none is left alone on a second row
      className={cn('not-prose my-8 w-full', facts.length === 3 && 'sm:grid-cols-3', className)}
    >
      {facts.map((fact, index) => (
        <CardGridItem key={`${index}-${fact.label}`}>
          <FactCard fact={fact} />
        </CardGridItem>
      ))}
    </CardGrid>
  )
}
