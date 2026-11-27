import React from 'react'

import {
  formatChangeAmount,
  formatChangePercent,
  formatCompactMoney,
  toRankedRows,
} from '@/platform/lib/chart/change'
import { BarTrack } from '@/platform/ui/BarTrack'
import { Disclosure } from '@/platform/ui/Disclosure'

import type { ChartAdapter } from '../../chartAdapter'
import { CHART_PALETTE } from '../../chartPalette'

import { RankedRow } from './RankedRow'

/**
 * The compact look of a bar chart (#1503): ranked rows, each a name, a small bar on one shared
 * scale, the figure and its change from the earlier amount; the rows past the first few wait under
 * "See the smaller pieces", as in the breakdown. Small figures look small, and a dozen rows fit the
 * screen where the big bars did not. Everything is text but the bar.
 */
export const rowsAdapter: ChartAdapter = {
  name: 'rows',
  output: 'html',
  kinds: new Set<'bar'>(['bar']),
  accepts: (spec) => spec.kind === 'bar' && spec.density === 'compact',
  usesColour: false,
  enlargeable: false,
  render(spec) {
    if (spec.kind !== 'bar') throw new Error(`The rows adapter does not draw ${spec.kind} charts`)
    const { visible, smaller } = toRankedRows(spec)
    const row = (item: (typeof visible)[number]) => (
      <RankedRow
        key={item.key}
        name={item.label}
        value={formatCompactMoney(item.value)}
        change={
          item.change && {
            direction: item.change.direction,
            amount: formatChangeAmount(item.change.amount),
            percent: formatChangePercent(item.change.percent),
          }
        }
        bar={
          <BarTrack
            width={item.width}
            radius={4}
            className="h-2"
            fillClassName={CHART_PALETTE[0].fill}
            mark={{ 'data-chart-mark': item.key }}
          />
        }
      />
    )
    return (
      <div className="space-y-2">
        {spec.previousLabel && (
          <p className="text-xs text-muted-foreground">Change from {spec.previousLabel}</p>
        )}
        <ul role="list" className="divide-y divide-border">
          {visible.map(row)}
        </ul>
        {smaller.length > 0 && (
          <Disclosure variant="link" summary="See the smaller pieces">
            <ul role="list" className="divide-y divide-border">
              {smaller.map(row)}
            </ul>
          </Disclosure>
        )}
      </div>
    )
  },
}
