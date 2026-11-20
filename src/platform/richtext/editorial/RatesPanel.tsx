import React, { useId } from 'react'

import { cn } from '@/platform/lib/cn'
import { Card } from '@/platform/ui/Card'
import { SliceName } from '@/platform/ui/ShareBill'
import { Text } from '@/platform/ui/Text'

import type { RateLine } from './billRates'

/**
 * The rates the bill is worked out from (#1351), beside the answer card: one line per body with its
 * name and the year its rate is from on the left, and its rate as a percent with the same rate in
 * dollars per $1,000 of value on the right. The City's line is highlighted, since the tab is about
 * the City's tax. Every line is built the same way and as tall as the others, so the lines sit level
 * in every year and the panel never changes height; a body with no rate keeps its line, with a dash
 * for each figure. The note under the lines (the editor's wording) says why a rate is from an
 * earlier year; where it does not apply it keeps its room, hidden from everyone. It draws what it is
 * given.
 */
export function RatesPanel({
  title,
  lines,
  note,
}: {
  title: string
  lines: readonly RateLine[]
  note: { text: string; shown: boolean } | null
}) {
  const titleId = useId()
  return (
    <Card as="section" variant="elevated" padding="xs" aria-labelledby={titleId}>
      <div className="space-y-2">
        <Text
          variant="small"
          as="h3"
          id={titleId}
          className="text-xs font-semibold text-foreground"
        >
          {title}
        </Text>
        <ul className="space-y-1">
          {lines.map((line) => (
            <li
              key={line.key}
              data-city={line.key === 'city' ? '' : undefined}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1',
                line.key === 'city' && 'bg-accent/10',
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  <SliceName name={line.name} shortName={line.shortName} />
                </span>
                <Text variant="small" as="span" className="block text-xs">
                  {`${line.year} rate`}
                </Text>
              </span>
              <span className="text-right tabular-nums">
                {line.percent === null ? (
                  <Text variant="small" as="span" className="block text-xs">
                    No rate yet
                  </Text>
                ) : (
                  <>
                    <span className="block text-sm font-semibold text-foreground">
                      {line.percent}
                    </span>
                    <Text variant="small" as="span" className="block text-xs">
                      {`${line.perThousand} per $1,000`}
                    </Text>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        {note && (
          <div aria-hidden={note.shown ? undefined : true}>
            <Text
              variant="small"
              as="p"
              className={cn('text-xs leading-snug', !note.shown && 'invisible')}
            >
              {note.text}
            </Text>
          </div>
        )}
      </div>
    </Card>
  )
}
