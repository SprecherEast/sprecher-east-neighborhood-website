import React from 'react'

import { Disclosure } from '@/platform/ui/Disclosure'
import { EmptyState } from '@/platform/ui/EmptyState'
import { Link } from '@/platform/ui/Link'
import { Text } from '@/platform/ui/Text'

import { planIssuePath } from '../domain/paths'
import type { Plan, PlanEpic } from '../domain/types'
import { dueLabel } from './dueLabel'
import { IssueList } from './IssueList'
import { IssueMarkdown } from './IssueMarkdown'
import { ProgressSummary } from './ProgressSummary'

function EpicBox({ epic, now }: { epic: PlanEpic; now: Date }) {
  return (
    <Disclosure
      variant="card"
      summary={<ProgressSummary name={epic.title} level="epic" issues={epic.children} now={now} />}
    >
      <div className="space-y-3">
        <Link href={planIssuePath(epic.number)} variant="inline">
          Read about this epic
          <span className="sr-only">: {epic.title}</span>
        </Link>
        {epic.children.length > 0 ? (
          <IssueList issues={epic.children} />
        ) : (
          <Text variant="small">No issues to show under this epic yet.</Text>
        )}
      </div>
    </Disclosure>
  )
}

const epicIssues = (epics: PlanEpic[]) => epics.flatMap((epic) => epic.children)

export function PlanTree({ plan, now }: { plan: Plan; now: Date }) {
  const empty = plan.milestones.length === 0 && plan.unscheduled.length === 0
  if (empty) {
    return (
      <EmptyState
        title="We can’t show the plan right now"
        description="It comes from GitHub and fills in again within the hour. Please check back soon."
      />
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {plan.milestones.map((milestone) => {
          const closed = milestone.state === 'closed'
          const facts = [dueLabel(milestone.dueOn, now, closed), closed && 'Closed']
            .filter(Boolean)
            .join(' · ')
          return (
            <Disclosure
              key={milestone.number}
              variant="card"
              summary={
                <ProgressSummary
                  name={milestone.title}
                  level="milestone"
                  issues={epicIssues(milestone.epics)}
                  now={now}
                >
                  {facts && (
                    <Text variant="small" as="span">
                      {facts}
                    </Text>
                  )}
                </ProgressSummary>
              }
            >
              <div className="space-y-4">
                {milestone.description && <IssueMarkdown>{milestone.description}</IssueMarkdown>}
                {milestone.epics.map((epic) => (
                  <EpicBox key={epic.number} epic={epic} now={now} />
                ))}
              </div>
            </Disclosure>
          )
        })}
      </div>

      {plan.unscheduled.length > 0 && (
        <section className="space-y-4">
          <Text variant="subsection">Not yet in a milestone</Text>
          {plan.unscheduled.map((epic) => (
            <EpicBox key={epic.number} epic={epic} now={now} />
          ))}
        </section>
      )}

      {plan.hiddenCount > 0 && (
        <Text variant="small">
          {plan.hiddenCount === 1
            ? '1 issue isn’t shown'
            : `${plan.hiddenCount} issues aren’t shown`}
          . A few things stay private, such as server work and decisions we’re still waiting on.
        </Text>
      )}
    </div>
  )
}
