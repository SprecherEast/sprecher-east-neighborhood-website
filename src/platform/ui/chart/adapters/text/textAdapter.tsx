import React from 'react'

import { toChartPoints, type ChartPoint } from '@/platform/lib/chart/table'
import { CHART_KINDS } from '@/platform/lib/chart/spec'
import { Text } from '@/platform/ui/Text'

import type { ChartAdapter } from '../../chartAdapter'

/** The points, kept in order, under the group they belong to */
function groupPoints(points: ChartPoint[]) {
  const groups = new Map<string | null, ChartPoint[]>()
  for (const point of points) groups.set(point.group, [...(groups.get(point.group) ?? []), point])
  return [...groups]
}

/**
 * The text adapter (#639): every number as a line of words, no picture. It supports every kind, so
 * it is the fallback for a kind no other adapter draws, and the second adapter the contract runs
 * against: a chart that cannot be drawn is still readable.
 */
export const textAdapter: ChartAdapter = {
  name: 'text',
  output: 'html',
  kinds: new Set(CHART_KINDS),
  usesColour: false,
  render(spec) {
    return (
      <div className="space-y-4">
        {groupPoints(toChartPoints(spec)).map(([group, points]) => (
          <div key={group ?? 'all'}>
            {group && (
              <Text variant="small" as="p" className="mb-1 font-semibold text-foreground">
                {group}
              </Text>
            )}
            <ul role="list" className="space-y-1 text-base text-foreground">
              {points.map((point) => (
                <li key={point.label} data-chart-mark="">
                  {point.label}: <span className="font-semibold">{point.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  },
}
