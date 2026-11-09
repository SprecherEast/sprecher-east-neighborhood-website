import React from 'react'

import { formatDateTime } from '@/platform/lib/formatDateTime'
import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import type { PlanStats } from '../domain/stats'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The numbers at the top of the plan: what's open, what's done, and what we finished lately */
export function PlanSummary({ stats, generatedAt }: { stats: PlanStats; generatedAt: string }) {
  const tiles = [
    { name: 'Open', value: stats.open },
    { name: 'Done', value: stats.done },
    { name: 'Done this week', value: stats.doneThisWeek },
    { name: 'Done this month', value: stats.doneThisMonth },
  ]

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(({ name, value }) => (
          <Card key={name} variant="muted" padding="sm" className="flex flex-col-reverse gap-1">
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
        {count(stats.milestones, 'milestone', 'milestones')} · {count(stats.epics, 'epic', 'epics')}
        , {stats.epicsDone} done. Updated {formatDateTime(generatedAt)}.
      </Text>
    </div>
  )
}
