import React from 'react'

import { Card, CardTitle } from '@/platform/ui/Card'
import { Text } from '@/platform/ui/Text'

import { planMissionPath } from '../domain/paths'
import { weekActivity } from '../domain/series'
import { issueProgress } from '../domain/stats'
import type { PlanMilestone } from '../domain/types'
import { ActivityMark } from './ActivityMark'
import type { WeekView } from './WeekMap'
import { WeekMap } from './WeekMap'

/** What a mission is made of, for its numbers and its week */
export const missionIssues = (mission: PlanMilestone) =>
  mission.epics.flatMap((epic) => epic.children)

/** "1 of 2 done", with the count in bold: the one small number on a mission */
export function DoneCount({ mission, now }: { mission: PlanMilestone; now: Date }) {
  const { done, total } = issueProgress(missionIssues(mission), now)
  return (
    <Text variant="small" as="p">
      <span className="font-bold text-foreground tabular-nums">{done}</span> of {total} done
    </Text>
  )
}

/**
 * One mission as a block on a tablet or desktop: its name (a link to its page), a small count,
 * whether it was quiet this week and the week as a heat map as wide as the block. Every block is
 * the same size.
 */
export function MissionBlock({
  mission,
  now,
  week,
}: {
  mission: PlanMilestone
  now: Date
  /** Under the day filter: the issues its week counts, and the days that can be pressed */
  week?: WeekView
}) {
  const issues = missionIssues(mission)
  const weekIssues = week?.issues ?? issues
  return (
    <Card as="article" variant="elevated" padding="sm" interactive className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <CardTitle
          as="h3"
          href={planMissionPath(mission.number)}
          className="text-base break-words sm:text-lg"
        >
          {mission.title}
        </CardTitle>
        <ActivityMark quiet={weekActivity(weekIssues, now).quiet} />
      </div>
      <div className="mt-auto space-y-3">
        <DoneCount mission={mission} now={now} />
        <WeekMap name={mission.title} issues={weekIssues} now={now} selection={week?.selection} />
      </div>
    </Card>
  )
}
