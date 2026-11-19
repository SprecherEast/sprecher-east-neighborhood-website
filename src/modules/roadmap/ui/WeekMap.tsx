import React from 'react'

import { HeatMap } from '@/platform/ui/HeatMap'
import type { DaySelection } from '@/platform/ui/HeatCell'

import { weekActivity } from '../domain/series'
import type { PlanIssue } from '../domain/types'

/** What a week strip needs under the day filter: the issues it counts, and the days that can be pressed */
export type WeekView = { issues: PlanIssue[]; selection?: DaySelection }

/**
 * The last seven days of finished work for a group of issues, as a heat map as wide as its box.
 * With a `selection` the days can be pressed to narrow that group further.
 */
export function WeekMap({
  name,
  issues,
  now,
  selection,
}: {
  name: string
  issues: PlanIssue[]
  now: Date
  selection?: DaySelection
}) {
  const { days, finished } = weekActivity(issues, now)
  return (
    <HeatMap
      variant="week"
      days={days}
      values={finished}
      label={`${name}, finished each day this week: ${finished.join(', ')}`}
      selection={selection}
    />
  )
}
