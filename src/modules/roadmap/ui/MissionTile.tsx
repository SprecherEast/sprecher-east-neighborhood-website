import React from 'react'

import { cn } from '@/platform/lib/cn'
import { Card, CardTitle } from '@/platform/ui/Card'

import type { PlanActivity } from '../domain/activity'
import { planMissionPath } from '../domain/paths'
import type { PlanMilestone } from '../domain/types'
import { MissionFigures } from './MissionFigures'

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
      <MissionFigures
        mission={mission}
        series={series}
        max={max}
        stepLabel={stepLabel}
        size={featured ? 'featured' : 'tile'}
        now={now}
      />
    </Card>
  )
}
