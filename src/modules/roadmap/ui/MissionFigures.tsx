import React from 'react'

import { cn } from '@/platform/lib/cn'
import { ProgressBar } from '@/platform/ui/ProgressBar'
import { Sparkline } from '@/platform/ui/Sparkline'
import { Text } from '@/platform/ui/Text'

import type { PlanActivity } from '../domain/activity'
import { issueProgress } from '../domain/stats'
import type { PlanMilestone } from '../domain/types'
import { activityLabel, recentWords } from './activityWords'

/** How big the figures are and whether the numbers behind the picture are written out */
const SIZES = {
  tile: { number: 'text-2xl', picture: 'h-8', bar: 'sm', writeNumbers: false },
  featured: { number: 'text-4xl', picture: 'h-12', bar: 'sm', writeNumbers: true },
  page: { number: 'text-3xl', picture: 'h-10', bar: 'md', writeNumbers: true },
} as const

/**
 * What a mission shows wherever it appears: how many are done, a bar, the activity over time on
 * the plan's shared scale and the same news in words. Its tile, its featured tile and its page
 * differ only in size, so they all draw it here.
 */
export function MissionFigures({
  mission,
  series,
  max,
  stepLabel,
  size,
  now,
}: {
  mission: PlanMilestone
  series: number[]
  max: number
  stepLabel: PlanActivity['stepLabel']
  size: keyof typeof SIZES
  now: Date
}) {
  const { done, total } = issueProgress(
    mission.epics.flatMap((epic) => epic.children),
    now,
  )
  const look = SIZES[size]

  return (
    <>
      <Text variant="small" as="p">
        <span className={cn('font-bold text-foreground tabular-nums', look.number)}>{done}</span> of{' '}
        {total} done
      </Text>
      <ProgressBar
        value={done}
        max={total}
        size={look.bar}
        label={`${mission.title}: ${done} of ${total} done`}
      />
      <Sparkline
        values={series}
        max={max}
        label={activityLabel(series, stepLabel)}
        className={look.picture}
      />
      <Text variant="small">
        {look.writeNumbers ? `Last ${series.length} ${stepLabel}: ${series.join(', ')} · ` : ''}
        {recentWords(series, done, stepLabel)}
      </Text>
    </>
  )
}
