'use client'

import React from 'react'

import { formatDayLabel } from '@/platform/lib/formatDateTime'
import { Button } from '@/platform/ui/Button'
import { EmptyState } from '@/platform/ui/EmptyState'
import { Text } from '@/platform/ui/Text'

import { type Level, filterPlan } from '../domain/filterPlan'
import type { Plan } from '../domain/types'
import { EpicBox } from './EpicBox'
import { MissionAccordion } from './MissionAccordion'
import { MissionBlock } from './MissionBlock'
import { usePlanFilter } from './PlanFilter.client'
import type { WeekView } from './WeekMap'

/**
 * The missions, and the projects outside any mission, narrowed by the day filter: blocks on a
 * tablet or desktop, accordions on a phone, the mission with the latest activity first. Only the
 * issues opened or finished on the chosen days stay; a mission or project with none is hidden.
 * With no day chosen this is the whole plan, which is also what loads and what shows without scripts.
 */
export function PlanMissions({ plan, order, now }: { plan: Plan; order: number[]; now: Date }) {
  const { top, picks, togglePick, clear } = usePlanFilter()
  const filtered = React.useMemo(() => filterPlan(plan, top, picks, now), [plan, top, picks, now])

  const weekView = (level: Level): WeekView => ({
    issues: level.weekIssues,
    // Under a single chosen day nothing can be pressed: that day is fixed and the rest are unavailable
    selection: {
      selected: level.locked ? level.parent : level.pick,
      enabled: level.enabled,
      unavailableReason: 'not selected above',
      onToggle: (day) => togglePick(level.scope, day),
    },
  })

  const rank = new Map(order.map((number, index) => [number, index]))
  const missions = [...filtered.missions].sort(
    (a, b) => (rank.get(a.mission.number) ?? 0) - (rank.get(b.mission.number) ?? 0),
  )
  const filtering = top.length > 0 || Object.keys(picks).length > 0
  const days = top.length > 0 ? top : [...new Set(Object.values(picks).flat())].sort()
  const nothing = filtering && missions.length === 0 && filtered.unscheduled.length === 0

  return (
    <div className="space-y-8">
      <div role="status" className="empty:hidden">
        {filtering && (
          <Text variant="small">
            {nothing
              ? 'Nothing matches.'
              : `Showing ${filtered.total} ${filtered.total === 1 ? 'issue' : 'issues'} opened or finished on ${days.map(formatDayLabel).join(', ')}.`}
          </Text>
        )}
      </div>

      {nothing && (
        <EmptyState
          title="Nothing was opened or finished then"
          description="Pick other days on the map, or show the whole plan again."
          action={
            <Button variant="secondary" size="sm" onClick={clear}>
              Show everything
            </Button>
          }
        />
      )}

      {missions.length > 0 && (
        <>
          <div
            data-plan-layout="blocks"
            className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3"
          >
            {missions.map((scoped) => (
              <MissionBlock
                key={scoped.mission.number}
                mission={scoped.mission}
                now={now}
                week={weekView(scoped)}
              />
            ))}
          </div>
          <div data-plan-layout="accordions" className="space-y-3 md:hidden">
            {missions.map((scoped) => (
              <MissionAccordion
                key={scoped.mission.number}
                mission={scoped.mission}
                now={now}
                week={weekView(scoped)}
                weekFor={(epicNumber) => {
                  const project = scoped.epics.find(({ epic }) => epic.number === epicNumber)
                  return project && weekView(project)
                }}
              />
            ))}
          </div>
        </>
      )}

      {filtered.unscheduled.length > 0 && (
        <section className="space-y-4">
          <Text variant="subsection">Projects not yet in a mission</Text>
          {filtered.unscheduled.map((scoped) => (
            <EpicBox
              key={scoped.epic.number}
              epic={scoped.epic}
              now={now}
              week={weekView(scoped)}
            />
          ))}
        </section>
      )}
    </div>
  )
}
