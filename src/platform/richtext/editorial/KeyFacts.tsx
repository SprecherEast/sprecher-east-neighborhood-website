import React from 'react'

import { cn } from '@/platform/lib/cn'
import { CardGrid, CardGridItem } from '@/platform/ui/CardGrid'
import { SHARED_ROWS_SPACE_4, SUBGRID_FOUR_ROWS } from '@/platform/ui/layoutSizes'

import { FactCard } from './FactCard'
import type { KeyFactsProps } from './keyFacts'

/**
 * Columns by the block's own width (a container query, so it reads the same in a post body and in
 * a narrow column), never by the screen: three facts sit three across only where each card has
 * room, and stack one per row below that, never two and a lonely one. Two, four or five facts
 * pair up from `@lg`; six go in twos, then in threes.
 */
function columnsFor(count: number) {
  if (count === 3) return '@2xl:grid-cols-3'
  if (count % 3 === 0) return '@lg:grid-cols-2 @2xl:grid-cols-3'
  return '@lg:grid-cols-2'
}

/**
 * A row of small fact cards (#509, #660), after the USWDS icon list and summary box: an icon beside
 * what the fact is, a big short value, how sure we are in words, and the source (`FactCard`). In
 * the shared `CardGrid`, a list, so screen readers hear how many facts there are. The cards share
 * their rows (subgrid), so the values and sources line up even when one title wraps (#678). The
 * row gap is zero because a shared row's gap would sit between a card's own rows: each card keeps
 * its distance from the next one below with a bottom margin, which the list's negative margin
 * takes back at the end.
 */
export function KeyFacts({ facts, className }: KeyFactsProps & { className?: string }) {
  if (facts.length === 0) return null
  return (
    <div className={cn('not-prose @container my-8 w-full', className)}>
      <CardGrid
        columns="none"
        gap="sm"
        className={cn(SHARED_ROWS_SPACE_4.list, columnsFor(facts.length))}
      >
        {facts.map((fact, index) => (
          <CardGridItem
            key={`${index}-${fact.label}`}
            className={cn(SUBGRID_FOUR_ROWS, SHARED_ROWS_SPACE_4.item)}
          >
            <FactCard fact={fact} />
          </CardGridItem>
        ))}
      </CardGrid>
    </div>
  )
}
