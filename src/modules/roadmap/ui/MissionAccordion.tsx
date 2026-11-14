import React from 'react'

import { Disclosure } from '@/platform/ui/Disclosure'
import { Link } from '@/platform/ui/Link'

import { planMissionPath } from '../domain/paths'
import { weekActivity } from '../domain/series'
import type { PlanMilestone } from '../domain/types'
import { ActivityMark } from './ActivityMark'
import { EpicBox } from './EpicBox'
import { DoneCount, missionIssues } from './MissionBlock'
import { WeekMap } from './WeekMap'

/**
 * One mission on a phone: a box that starts closed, showing its name, a small count and whether it
 * was quiet this week. Opened, it shows the week as a heat map, a link to its page and its projects,
 * each of which opens to its own week and its issues.
 */
export function MissionAccordion({ mission, now }: { mission: PlanMilestone; now: Date }) {
  const issues = missionIssues(mission)
  return (
    <Disclosure
      variant="card"
      summary={
        <span className="flex flex-col gap-1">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 font-semibold break-words">{mission.title}</span>
            <ActivityMark quiet={weekActivity(issues, now).quiet} />
          </span>
          <DoneCount mission={mission} now={now} />
        </span>
      }
    >
      <div className="space-y-4">
        <WeekMap name={mission.title} issues={issues} now={now} />
        <Link href={planMissionPath(mission.number)} variant="inline">
          Open this mission
          <span className="sr-only">: {mission.title}</span>
        </Link>
        <div className="space-y-3">
          {mission.epics.map((epic) => (
            <EpicBox key={epic.number} epic={epic} now={now} />
          ))}
        </div>
      </div>
    </Disclosure>
  )
}
