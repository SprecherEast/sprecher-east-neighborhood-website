import React from 'react'

import { Card } from '@/platform/ui/Card'
import { ProgressBar } from '@/platform/ui/ProgressBar'
import { Sparkline } from '@/platform/ui/Sparkline'
import { Text } from '@/platform/ui/Text'

import type { MissionActivity, PlanActivity } from '../domain/activity'
import { issueProgress } from '../domain/stats'
import type { PlanMilestone } from '../domain/types'
import { activityLabel, recentWords } from './activityWords'
import { EpicBox } from './EpicBox'

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
  const { done, total } = issueProgress(
    mission.epics.flatMap((epic) => epic.children),
    now,
  )

  return (
    <div className="space-y-8">
      <Card variant="muted" padding="sm" className="space-y-3">
        <Text variant="small" as="p">
          <span className="text-3xl font-bold text-foreground tabular-nums">{done}</span> of {total}{' '}
          done
        </Text>
        <ProgressBar
          value={done}
          max={total}
          label={`${mission.title}: ${done} of ${total} done`}
        />
        <Sparkline
          values={activity.series}
          max={activity.max}
          className="h-10"
          label={activityLabel(activity.series, activity.stepLabel)}
        />
        <Text variant="small">
          Last {activity.series.length} {activity.stepLabel}: {activity.series.join(', ')} ·{' '}
          {recentWords(activity.series, done, activity.stepLabel)}
        </Text>
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
