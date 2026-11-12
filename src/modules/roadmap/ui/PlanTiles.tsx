import React from 'react'

import { Button } from '@/platform/ui/Button'
import { EmptyState } from '@/platform/ui/EmptyState'
import { Text } from '@/platform/ui/Text'

import { planActivity } from '../domain/activity'
import type { Plan } from '../domain/types'
import { EpicBox } from './EpicBox'
import { MissionTile } from './MissionTile'

/**
 * The plan as tiles: the mission with the latest activity first and larger, then the rest, each
 * opening its own page. Projects that belong to no mission follow, then a note on what is not shown.
 */
export function PlanTiles({ plan, now }: { plan: Plan; now: Date }) {
  const empty = plan.milestones.length === 0 && plan.unscheduled.length === 0
  if (empty) {
    return (
      <EmptyState
        title="We can’t show the plan right now"
        description="It comes from GitHub and fills in again within the hour. Please check back soon."
      />
    )
  }

  const activity = planActivity(plan.milestones, now)
  const byNumber = new Map(plan.milestones.map((mission) => [mission.number, mission]))

  return (
    <div className="space-y-8">
      {activity.missions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {activity.missions.map(({ milestoneNumber, series }, index) => {
            const mission = byNumber.get(milestoneNumber)
            return mission ? (
              <MissionTile
                key={milestoneNumber}
                mission={mission}
                series={series}
                max={activity.max}
                stepLabel={activity.stepLabel}
                featured={index === 0}
                now={now}
              />
            ) : null
          })}
        </div>
      )}

      {plan.unscheduled.length > 0 && (
        <section className="space-y-4">
          <Text variant="subsection">Projects not yet in a mission</Text>
          {plan.unscheduled.map((epic) => (
            <EpicBox key={epic.number} epic={epic} now={now} />
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Text variant="small">Missing something?</Text>
        <Button href="/contact" variant="secondary" size="sm">
          Tell us
        </Button>
      </div>

      {plan.hiddenCount > 0 && (
        <Text variant="small">
          {plan.hiddenCount === 1
            ? '1 issue isn’t shown'
            : `${plan.hiddenCount} issues aren’t shown`}
          . A few things stay private, such as server work and decisions we’re still waiting on.
        </Text>
      )}
    </div>
  )
}
