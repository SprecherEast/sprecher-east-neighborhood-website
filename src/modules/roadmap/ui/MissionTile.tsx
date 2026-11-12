import React from 'react'

import { cn } from '@/platform/lib/cn'
import { Card, CardTitle } from '@/platform/ui/Card'
import { ProgressBar } from '@/platform/ui/ProgressBar'
import { Sparkline } from '@/platform/ui/Sparkline'
import { Text } from '@/platform/ui/Text'

import type { PlanActivity } from '../domain/activity'
import { planMissionPath } from '../domain/paths'
import { issueProgress } from '../domain/stats'
import type { PlanMilestone } from '../domain/types'
import { activityLabel, recentWords } from './activityWords'

/**
 * One mission as a tile that opens its own page: its name, how many are done, a bar, the activity
 * over time on the plan's shared scale and the same news in words. The featured tile, the mission
 * with the latest activity, is larger and also writes out the numbers behind its picture.
 */
export function MissionTile({
  mission,
  series,
  max,
  stepLabel,
  featured,
  now,
}: {
  mission: PlanMilestone
  series: number[]
  max: number
  stepLabel: PlanActivity['stepLabel']
  featured?: boolean
  now: Date
}) {
  const { done, total } = issueProgress(
    mission.epics.flatMap((epic) => epic.children),
    now,
  )

  return (
    <Card
      as="article"
      variant="elevated"
      padding={featured ? 'lg' : 'sm'}
      interactive
      className={cn('space-y-3', featured && 'sm:col-span-2')}
    >
      <CardTitle as="h3" href={planMissionPath(mission.number)}>
        {mission.title}
      </CardTitle>
      <Text variant="small" as="p">
        <span
          className={cn(
            'font-bold text-foreground tabular-nums',
            featured ? 'text-4xl' : 'text-2xl',
          )}
        >
          {done}
        </span>{' '}
        of {total} done
      </Text>
      <ProgressBar
        value={done}
        max={total}
        size="sm"
        label={`${mission.title}: ${done} of ${total} done`}
      />
      <Sparkline
        values={series}
        max={max}
        label={activityLabel(series, stepLabel)}
        className={featured ? 'h-12' : 'h-8'}
      />
      <Text variant="small">
        {featured ? `Last ${series.length} ${stepLabel}: ${series.join(', ')} · ` : ''}
        {recentWords(series, done, stepLabel)}
      </Text>
    </Card>
  )
}
