import React from 'react'

import { Card, CardTitle } from '@/platform/ui/Card'

import type { PlanActivity } from '../domain/activity'
import { planMissionPath } from '../domain/paths'
import type { PlanMilestone } from '../domain/types'
import { MissionFigures } from './MissionFigures'

/**
 * One mission as a tile that opens its own page: its name, how many are done, a bar, the activity
 * over time on the plan's shared scale and the same news in words. Every tile is the same size.
 */
export function MissionTile({
  mission,
  series,
  max,
  stepLabel,
  now,
}: {
  mission: PlanMilestone
  series: number[]
  max: number
  stepLabel: PlanActivity['stepLabel']
  now: Date
}) {
  return (
    <Card as="article" variant="elevated" padding="sm" interactive className="flex flex-col gap-3">
      <CardTitle
        as="h3"
        href={planMissionPath(mission.number)}
        className="text-base break-words sm:text-lg"
      >
        {mission.title}
      </CardTitle>
      <div className="mt-auto space-y-3">
        <MissionFigures
          mission={mission}
          series={series}
          max={max}
          stepLabel={stepLabel}
          size="tile"
          now={now}
        />
      </div>
    </Card>
  )
}
