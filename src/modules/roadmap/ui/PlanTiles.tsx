import React from 'react'

import { Button } from '@/platform/ui/Button'
import { EmptyState } from '@/platform/ui/EmptyState'
import { Text } from '@/platform/ui/Text'

import { planActivity } from '../domain/activity'
import { leanPlan } from '../domain/filterPlan'
import type { Plan } from '../domain/types'
import { PlanMissions } from './PlanMissions.client'

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

  const order = planActivity(plan.milestones, now).missions.map(
    ({ milestoneNumber }) => milestoneNumber,
  )

  return (
    <div className="space-y-8">
      <PlanMissions plan={leanPlan(plan)} order={order} now={now} />

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
