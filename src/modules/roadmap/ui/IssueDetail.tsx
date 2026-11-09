import React from 'react'

import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import type { PlanEpic, PlanIssue } from '../domain/types'
import { LabelBadges, StateBadge } from './IssueBadges'
import { IssueList } from './IssueList'
import { IssueMarkdown } from './IssueMarkdown'

/**
 * What one issue or epic says: its status and labels, its text, the issues under an epic and the
 * link to GitHub. The issue's own page and the dialog the plan opens it in both show this, so the
 * two never differ (#946).
 */
export function IssueDetail({ issue }: { issue: PlanIssue | PlanEpic }) {
  const children = 'children' in issue ? issue.children : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge state={issue.state} />
        <LabelBadges labels={issue.labels} />
      </div>
      {issue.description.trim() ? (
        <IssueMarkdown>{issue.description}</IssueMarkdown>
      ) : (
        <Text variant="small">There’s no description for this one yet.</Text>
      )}
      {children.length > 0 && (
        <section className="space-y-2">
          <Text variant="subsection">Issues in this epic</Text>
          <IssueList issues={children} />
        </section>
      )}
      <Link href={issue.url} external variant="inline">
        See it on GitHub
      </Link>
    </div>
  )
}
