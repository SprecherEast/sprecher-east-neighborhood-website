import 'server-only'

import { findPlanIssue } from '../domain/plan'
import { parseIssueNumber } from '../domain/paths'
import type { PlanEpic, PlanIssue } from '../domain/types'
import { getPlan } from './getPlan'

/** An epic or issue the public plan shows, or `undefined`: screened ones answer like unknown ones */
export async function getPlanIssue(number: number): Promise<PlanIssue | PlanEpic | undefined> {
  return findPlanIssue(await getPlan(), number)
}

/** The same, from the address segment: a malformed one answers like an unknown number */
export async function getPlanIssueFromAddress(value: string) {
  const number = parseIssueNumber(value)
  return number === undefined ? undefined : getPlanIssue(number)
}

/** Every number the plan shows, for the pages to build ahead of time */
export async function listPlanIssueNumbers(): Promise<number[]> {
  const plan = await getPlan()
  const epics = [...plan.milestones.flatMap((m) => m.epics), ...plan.unscheduled]
  return epics.flatMap((epic) => [epic.number, ...epic.children.map((c) => c.number)])
}
