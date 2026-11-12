import React from 'react'

import { formatDateTime } from '@/platform/lib/formatDateTime'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import type { PlanStats } from '../domain/stats'

/** The three numbers at the top of the plan: what we finished this week, what is done in all, and what is still open */
export function PlanSummary({ stats, generatedAt }: { stats: PlanStats; generatedAt: string }) {
  const tiles = [
    { name: 'Finished this week', value: stats.doneThisWeek },
    { name: 'Done in all', value: stats.done },
    { name: 'Still open', value: stats.open },
  ]

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-3 sm:gap-4">
        {tiles.map(({ name, value }) => (
          <Card
            key={name}
            variant="muted"
            padding="sm"
            className="flex flex-col-reverse justify-end gap-1"
          >
            <dt>
              <Text variant="label" as="span">
                {name}
              </Text>
            </dt>
            <dd className="text-3xl font-bold text-foreground tabular-nums">{value}</dd>
          </Card>
        ))}
      </dl>
      <Text variant="small">
        Straight from our working plan. Updated {formatDateTime(generatedAt)}.
      </Text>
    </div>
  )
}
