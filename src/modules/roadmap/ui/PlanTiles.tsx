import React from 'react'

import { Button } from '@/platform/ui/Button'
import { EmptyState } from '@/platform/ui/EmptyState'
import { Text } from '@/platform/ui/Text'

import { planActivity } from '../domain/activity'
import type { Plan } from '../domain/types'
import { EpicBox } from './EpicBox'
import { MissionAccordion } from './MissionAccordion'
import { MissionBlock } from './MissionBlock'

/**
 * The plan as missions, the one with the latest activity first: blocks of the same size on a tablet
 * (two across) and a desktop (three across), accordions on a phone, each linking to its own page. Projects that belong to no mission
 * follow, then a note on what is not shown.
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
  const ordered = activity.missions.flatMap(
    ({ milestoneNumber }) => byNumber.get(milestoneNumber) ?? [],
  )

  return (
    <div className="space-y-8">
      {activity.missions.length > 0 && (
        <>
          <div
            data-plan-layout="blocks"
            className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3"
          >
            {ordered.map((mission) => (
              <MissionBlock key={mission.number} mission={mission} now={now} />
            ))}
          </div>
          <div data-plan-layout="accordions" className="space-y-3 md:hidden">
            {ordered.map((mission) => (
              <MissionAccordion key={mission.number} mission={mission} now={now} />
            ))}
          </div>
        </>
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
