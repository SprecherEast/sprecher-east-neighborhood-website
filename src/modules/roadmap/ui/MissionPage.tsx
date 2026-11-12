import React from 'react'

import { Card } from '@/platform/ui/Card'
import { ProgressBar } from '@/platform/ui/ProgressBar'
import { Sparkline } from '@/platform/ui/Sparkline'
import { Text } from '@/platform/ui/Text'

import type { MissionActivity, PlanActivity } from '../domain/activity'
import { issueProgress } from '../domain/stats'
import type { PlanMilestone } from '../domain/types'
import { EpicBox } from './EpicBox'

const STEP_WORD = { weeks: 'week', months: 'month', years: 'year' } as const

/** What the newest bucket says in words, so the picture is never the only signal */
function recentWords(series: number[], done: number, step: PlanActivity['stepLabel']) {
  if (done === 0) return 'Nothing finished yet'
  const latest = series.at(-1) ?? 0
  return latest > 0 ? `${latest} finished this ${STEP_WORD[step]}` : `Quiet this ${STEP_WORD[step]}`
}

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
  const unit = STEP_WORD[activity.stepLabel]

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
          label={`Finished each ${unit}, oldest first: ${activity.series.join(', ')}`}
        />
        <Text variant="small">
          Last {activity.series.length} {activity.stepLabel}: {activity.series.join(', ')} ·{' '}
          {recentWords(activity.series, done, activity.stepLabel)}
        </Text>
      </Card>

      <section className="space-y-4">
        <Text variant="subsection">Projects in this mission</Text>
        {mission.epics.map((epic) => (
          <EpicBox key={epic.number} epic={epic} now={now} />
        ))}
      </section>
    </div>
  )
}
