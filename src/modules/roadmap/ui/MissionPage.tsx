import React from 'react'

import { Card } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import type { MissionActivity, PlanActivity } from '../domain/activity'
import type { PlanMilestone } from '../domain/types'
import { EpicBox } from './EpicBox'
import { MissionFigures } from './MissionFigures'

/**
 * One mission: how much is done, the activity over time on the plan's shared scale, then its
 * projects as boxes that open to their issues.
 */
export function MissionPage({
  mission,
  activity,
  now,
}: {
  mission: PlanMilestone
  activity: Pick<PlanActivity, 'max' | 'stepLabel'> & Pick<MissionActivity, 'series'>
  now: Date
}) {
  return (
    <div className="space-y-8">
      <Card variant="muted" padding="sm" className="space-y-3">
        <MissionFigures
          mission={mission}
          series={activity.series}
          max={activity.max}
          stepLabel={activity.stepLabel}
          size="page"
          now={now}
        />
      </Card>

      <section className="space-y-4">
        <Text variant="subsection">Projects in this mission</Text>
        {mission.epics.map((epic, index) => (
          <EpicBox key={epic.number} epic={epic} now={now} defaultOpen={index === 0} />
        ))}
      </section>
    </div>
  )
}
