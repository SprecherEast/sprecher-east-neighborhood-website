import React from 'react'

import { formatDateShort } from '@/platform/lib/formatDateTime'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import { planIssuePath } from '../domain/paths'
import type { PlanIssue } from '../domain/types'
import { LabelBadges, StateBadge } from './IssueBadges'

function IssueRow({ issue }: { issue: PlanIssue }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div>
          <Link href={planIssuePath(issue.number)} variant="inline">
            {issue.title}
            <span className="sr-only"> (issue {issue.number})</span>
          </Link>
          <Text variant="small" as="span" className="ml-2">
            #{issue.number}
          </Text>
        </div>
        <LabelBadges labels={issue.labels} />
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <StateBadge state={issue.state} />
        {issue.state === 'done' && issue.closedAt && (
          <Text variant="small" as="span">
            Closed {formatDateShort(issue.closedAt)}
          </Text>
        )}
      </div>
    </li>
  )
}

/** The issues under an epic, one row each; used by the tree and by an epic's own page */
export function IssueList({ issues }: { issues: PlanIssue[] }) {
  return (
    <ul className="divide-y divide-border">
      {issues.map((issue) => (
        <IssueRow key={issue.number} issue={issue} />
      ))}
    </ul>
  )
}
