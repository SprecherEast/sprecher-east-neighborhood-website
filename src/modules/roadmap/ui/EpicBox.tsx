import React from 'react'

import { Disclosure } from '@/platform/ui/Disclosure'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import { planIssuePath } from '../domain/paths'
import type { PlanEpic } from '../domain/types'
import { IssueList } from './IssueList'
import { ProgressSummary } from './ProgressSummary'
import { WeekMap } from './WeekMap'

/** A project (an epic) as a box that opens: its progress, a link to its own page and its issues */
export function EpicBox({ epic, now }: { epic: PlanEpic; now: Date }) {
  return (
    <Disclosure
      variant="card"
      summary={<ProgressSummary name={epic.title} level="epic" issues={epic.children} now={now} />}
    >
      <div className="space-y-3">
        <WeekMap name={epic.title} issues={epic.children} now={now} />
        <Link href={planIssuePath(epic.number)} variant="inline">
          Read about this project
          <span className="sr-only">: {epic.title}</span>
        </Link>
        {epic.children.length > 0 ? (
          <IssueList issues={epic.children} />
        ) : (
          <Text variant="small">No issues to show under this project yet.</Text>
        )}
      </div>
    </Disclosure>
  )
}
