import React, { type ReactNode, useId } from 'react'

import { cn } from '@/platform/lib/cn'
import { Card } from '@/platform/ui/Card'
import { SliceName } from '@/platform/ui/ShareBill'
import { Text } from '@/platform/ui/Text'

import type { RateLine } from './billRates'
import type { StatusBadge } from './billShareView'
import { PanelHeader } from './PanelHeader'

/**
 * The rates the bill is worked out from (#1351), beside the answer card: one line per body with its
 * name and the year its rate is from on the left, and its rate as a percent with the same rate in
 * dollars per $1,000 of value on the right. The City's line is highlighted, since the tab is about
 * the City's tax. Every line is built the same way and as tall as the others, so the lines sit level
 * in every year and the panel never changes height; a body with no rate keeps its line, with
 * "No rate yet" in place of the figures. The year each rate is from is on every line, so the panel
 * never depends on the toast (`toast`, #1380) that says why: the page puts it over the panel's top
 * edge (the card is its positioned container), where it covers a sliver and takes no room, so the
 * panel is as tall in every year. It draws what it is given. Its title is the same header style as
 * the other two panels', and its status badge sits at the end of the title's line, a button that
 * opens the toast when it has something to say (#1417).
 */
export function RatesPanel({
  title,
  lines,
  toast,
  badge,
  onBadgePress,
}: {
  title: string
  lines: readonly RateLine[]
  /** A `Toast` placed over the panel's top edge, or any toast the page shows for it */
  toast?: ReactNode
  /** The status badge, at the end of the title's line (#1417) */
  badge?: StatusBadge | null
  /** Makes the badge a button that says why the rates are an estimate */
  onBadgePress?: () => void
}) {
  const titleId = useId()
  return (
    <Card as="section" variant="elevated" padding="xs" aria-labelledby={titleId}>
      <div className="space-y-2">
        <PanelHeader badge={badge} onBadgePress={onBadgePress}>
          <Text variant="subsection" as="h3" id={titleId}>
            {title}
          </Text>
        </PanelHeader>
        <ul className="space-y-1">
          {lines.map((line) => (
            <li
              key={line.key}
              data-city={line.key === 'city' ? '' : undefined}
              className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1 max-[24rem]:gap-x-2 max-[24rem]:px-1',
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
      </div>
      {toast}
    </Card>
  )
}
