import React from 'react'

import { formatDateShort } from '@/platform/lib/formatDateTime'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import { planIssuePath } from '../domain/paths'
import { plainTitle } from '../domain/title'
import type { PlanIssue } from '../domain/types'
import { StateBadge } from './IssueBadges'

function IssueRow({ issue }: { issue: PlanIssue }) {
  const closedAt = issue.state === 'done' ? issue.closedAt : null
  return (
    <li className="space-y-1 py-3">
      <div className="flex items-start justify-between gap-3">
        <Link href={planIssuePath(issue.number)} variant="inline" className="min-w-0">
          {plainTitle(issue.title)}
          <span className="sr-only"> (issue {issue.number})</span>
        </Link>
        <span className="shrink-0 whitespace-nowrap">
          <StateBadge state={issue.state} size="sm" />
        </span>
      </div>
      <Text variant="small">
        #{issue.number}
        {closedAt ? ` · Closed ${formatDateShort(closedAt)}` : ''}
      </Text>
    </li>
  )
}

/**
 * The issues under a project, one row each: the title with its state on the same line, never
 * wrapping below it, and the number and close date under the title. The plan, a mission's page and
 * a project's own page all show this, so the rows read the same.
 */
export function IssueList({ issues }: { issues: PlanIssue[] }) {
  return (
    <ul className="divide-y divide-border">
      {issues.map((issue) => (
        <IssueRow key={issue.number} issue={issue} />
      ))}
    </ul>
  )
}
