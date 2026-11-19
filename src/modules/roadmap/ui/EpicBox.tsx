import React from 'react'

import { Disclosure } from '@/platform/ui/Disclosure'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import { planIssuePath } from '../domain/paths'
import type { PlanEpic } from '../domain/types'
import { IssueList } from './IssueList'
import { ProgressSummary } from './ProgressSummary'
import { WeekMap, type WeekView } from './WeekMap'

/** A project (an epic) as a box that opens: its progress, a link to its own page and its issues */
export function EpicBox({
  epic,
  now,
  week,
}: {
  epic: PlanEpic
  now: Date
  /** Under the day filter: the issues its week counts, and the days that can be pressed */
  week?: WeekView
}) {
  return (
    <Disclosure
      variant="card"
      summary={<ProgressSummary name={epic.title} level="epic" issues={epic.children} now={now} />}
    >
      <div className="space-y-3">
        <WeekMap
          name={epic.title}
          issues={week?.issues ?? epic.children}
          now={now}
          selection={week?.selection}
        />
        <Link href={planIssuePath(epic.number)} variant="action">
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
