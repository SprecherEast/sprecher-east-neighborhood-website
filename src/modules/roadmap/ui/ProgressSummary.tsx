import { cva } from 'class-variance-authority'
import React from 'react'

import { ProgressBar } from '@/platform/ui/ProgressBar'
import { Text } from '@/platform/ui/Text'

import { issueProgress } from '../domain/stats'
import type { PlanIssue } from '../domain/types'

const nameVariants = cva('min-w-0', {
  variants: { level: { milestone: 'text-lg font-semibold', epic: 'font-medium' } },
})

/**
 * How far along a group of issues is: its name, the percent, a bar and the numbers in words.
 * Milestones and epics both use it, so they read the same. Anything extra, such as a due date,
 * goes in `children` under the numbers.
 */
export function ProgressSummary({
  name,
  level,
  issues,
  now,
  children,
}: {
  name: string
  level: 'milestone' | 'epic'
  issues: PlanIssue[]
  now: Date
  children?: React.ReactNode
}) {
  const { done, open, total, percent, doneThisWeek } = issueProgress(issues, now)
  const words =
    total === 0
      ? 'No issues yet'
      : [
          `${done} of ${total} done`,
          `${open} open`,
          doneThisWeek > 0 && `${doneThisWeek} done this week`,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <span className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <span className={nameVariants({ level })}>{name}</span>
        {total > 0 && (
          <span className="shrink-0 text-sm font-semibold text-primary-strong tabular-nums">
            {percent}%
          </span>
        )}
      </span>
      <ProgressBar value={done} max={total} size="sm" label={`${name}: ${done} of ${total} done`} />
      <Text variant="small" as="span">
        {words}
      </Text>
      {children}
    </span>
  )
}
