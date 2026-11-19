import { siteDate } from './stats'
import type { PlanIssue } from './types'

/*
 * The day filter. Days are `yyyy-mm-dd` on the site's calendar, oldest first. The top map, each
 * mission and each project hold their own choice of days, and the top commands the lower levels: a
 * lower level can only narrow what the level above allows, and under a single day it cannot pick
 * at all. A level with no pick follows the level above, so nothing chosen anywhere means no filter.
 */

/** A level that can hold its own pick: `mission:<number>` or `epic:<number>` */
export type Scope = string
export const missionScope = (number: number): Scope => `mission:${number}`
export const epicScope = (number: number): Scope => `epic:${number}`

/** Each level's picked days, a level with no pick left out */
export type Picks = Record<Scope, string[]>

/** The days an issue was opened and finished on, on the site's calendar; an issue decided against has neither */
function issueDays(issue: PlanIssue): string[] {
  if (issue.state === 'not-planned') return []
  const opened = issue.createdAt ? [siteDate(new Date(issue.createdAt))] : []
  const finished =
    issue.state === 'done' && issue.closedAt ? [siteDate(new Date(issue.closedAt))] : []
  return [...opened, ...finished]
}

/** Whether an issue was opened or finished on any of the days; with no day chosen, every issue matches */
export function matchesDays(issue: PlanIssue, days: readonly string[]): boolean {
  if (days.length === 0) return true
  return issueDays(issue).some((day) => days.includes(day))
}

/** How many issues were finished and how many were opened on a day */
export type DayCount = { finished: number; opened: number }

/** Finished and opened counts for every day something happened; a day with nothing is left out */
export function activityByDay(issues: readonly PlanIssue[]): Record<string, DayCount> {
  const activity: Record<string, DayCount> = {}
  for (const issue of issues) {
    if (issue.state === 'not-planned') continue
    const bump = (iso: string | null, kind: keyof DayCount) => {
      if (!iso) return
      const day = siteDate(new Date(iso))
      activity[day] ??= { finished: 0, opened: 0 }
      activity[day][kind] += 1
    }
    bump(issue.createdAt, 'opened')
    if (issue.state === 'done') bump(issue.closedAt, 'finished')
  }
  return activity
}

/** The days of `pick` the level above allows: all of them when nothing is chosen above, none under a single day */
export function allowedPick(parent: readonly string[], pick: readonly string[]): string[] {
  if (parent.length === 0) return [...pick]
  if (parent.length === 1) return []
  return pick.filter((day) => parent.includes(day))
}

/** The days a level filters by: its own pick when it has a valid one, otherwise the level above's */
export function effectiveDays(parent: readonly string[], pick: readonly string[]): string[] {
  const own = allowedPick(parent, pick)
  return own.length > 0 ? own : [...parent]
}

/** Which of a strip's days can be pressed: all with nothing chosen above, none under one day, else the chosen ones it shows */
export function stripEnabled(parent: readonly string[], stripDays: readonly string[]): string[] {
  if (parent.length === 0) return [...stripDays]
  if (parent.length === 1) return []
  return stripDays.filter((day) => parent.includes(day))
}

/**
 * Drops every pick the levels above no longer allow, parents before children. `parentOf` names
 * each level's parent (`null` for a level directly under the top map); parents are listed first.
 */
export function settleChoices(
  top: readonly string[],
  picks: Picks,
  parentOf: Record<Scope, Scope | null>,
): Picks {
  const settled: Picks = {}
  const effective: Record<Scope, string[]> = {}
  for (const [scope, parent] of Object.entries(parentOf)) {
    const above = parent === null ? [...top] : (effective[parent] ?? [...top])
    const kept = allowedPick(above, picks[scope] ?? [])
    if (kept.length > 0) settled[scope] = kept
    effective[scope] = effectiveDays(above, kept)
  }
  return settled
}
