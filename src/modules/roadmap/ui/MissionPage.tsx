import React from 'react'

import { Card } from '@/platform/ui/Card'
import { ProgressBar } from '@/platform/ui/ProgressBar'
import { Text } from '@/platform/ui/Text'

import { weekActivity } from '../domain/series'
import { issueProgress } from '../domain/stats'
import type { PlanMilestone } from '../domain/types'
import { ActivityMark } from './ActivityMark'
import { EpicBox } from './EpicBox'
import { DoneCount, missionIssues } from './MissionBlock'
import { WeekMap } from './WeekMap'

/**
 * One mission: how much is done, its week as a heat map, then its projects as boxes that open to
 * their own week and their issues.
 */
export function MissionPage({ mission, now }: { mission: PlanMilestone; now: Date }) {
  const issues = missionIssues(mission)
  const { done, total } = issueProgress(issues, now)
  return (
    <div className="space-y-8">
      <Card variant="muted" padding="sm" className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <DoneCount mission={mission} now={now} />
          <ActivityMark quiet={weekActivity(issues, now).quiet} />
        </div>
        <ProgressBar
          value={done}
          max={total}
          size="md"
          label={`${mission.title}: ${done} of ${total} done`}
        />
        <WeekMap name={mission.title} issues={issues} now={now} />
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
