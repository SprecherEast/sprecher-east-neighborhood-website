import { isShownPublicly } from './screen'
import type {
  Plan,
  PlanEpic,
  PlanIssue,
  PlanIssueState,
  PlanMilestone,
  RawEpic,
  RawIssue,
  RawMilestone,
} from './types'

const stateOf = ({ state, stateReason }: RawIssue): PlanIssueState =>
  state === 'open' ? 'open' : stateReason === 'not_planned' ? 'not-planned' : 'done'

const toIssue = (raw: RawIssue): PlanIssue => ({
  number: raw.number,
  title: raw.title,
  state: stateOf(raw),
  labels: raw.labels,
  description: raw.body,
  url: raw.url,
  closedAt: raw.closedAt,
})

/** The order a reader wants: open first, soonest due date first, none last, then by number */
const byMilestoneOrder = (a: RawMilestone, b: RawMilestone) => {
  if (a.state !== b.state) return a.state === 'open' ? -1 : 1
  if (a.dueOn !== b.dueOn) {
    if (a.dueOn === null) return 1
    if (b.dueOn === null) return -1
    return a.dueOn.localeCompare(b.dueOn)
  }
  return a.number - b.number
}

export function buildPlan({
  milestones,
  epics,
  generatedAt,
}: {
  milestones: RawMilestone[]
  epics: RawEpic[]
  generatedAt: string
}): Plan {
  let hiddenCount = 0
  const shown: { milestoneNumber: number | null; epic: PlanEpic }[] = []

  for (const { epic, children } of epics) {
    if (!isShownPublicly(epic)) {
      hiddenCount += 1 + children.length
      continue
    }
    const visible = children.filter(isShownPublicly)
    hiddenCount += children.length - visible.length
    shown.push({
      milestoneNumber: epic.milestoneNumber,
      epic: { ...toIssue(epic), children: visible.map(toIssue) },
    })
  }

  const known = new Set(milestones.map(({ number }) => number))
  const inMilestone = (number: number) =>
    shown.filter((s) => s.milestoneNumber === number).map((s) => s.epic)

  return {
    generatedAt,
    milestones: [...milestones]
      .filter(({ number }) => inMilestone(number).length > 0)
      .sort(byMilestoneOrder)
      .map((m): PlanMilestone => {
        // A title or description that holds something screened is left out; the milestone stays
        const shown = isShownPublicly({ labels: [], title: m.title, body: m.description })
        return {
          ...m,
          title: shown ? m.title : `Milestone ${m.number}`,
          description: shown ? m.description : '',
          epics: inMilestone(m.number),
        }
      }),
    unscheduled: shown
      .filter((s) => s.milestoneNumber === null || !known.has(s.milestoneNumber))
      .map((s) => s.epic),
    hiddenCount,
  }
}

/** An epic or an issue the plan shows, by number; screened ones are not in the plan */
export function findPlanIssue(plan: Plan, number: number): PlanIssue | undefined {
  const epics = [...plan.milestones.flatMap((m) => m.epics), ...plan.unscheduled]
  for (const epic of epics) {
    if (epic.number === number) return epic
    const child = epic.children.find((c) => c.number === number)
    if (child) return child
  }
  return undefined
}
