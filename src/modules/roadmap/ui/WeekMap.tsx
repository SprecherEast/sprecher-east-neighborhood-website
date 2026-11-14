import React from 'react'

import { HeatMap } from '@/platform/ui/HeatMap'

import { weekActivity } from '../domain/series'
import type { PlanIssue } from '../domain/types'

/** The last seven days of finished work for a group of issues, as a heat map as wide as its box */
export function WeekMap({ name, issues, now }: { name: string; issues: PlanIssue[]; now: Date }) {
  const { days, finished } = weekActivity(issues, now)
  return (
    <HeatMap
      variant="week"
      days={days}
      values={finished}
      label={`${name}, finished each day this week: ${finished.join(', ')}`}
    />
  )
}
