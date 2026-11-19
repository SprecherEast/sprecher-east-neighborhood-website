import { siteDate } from './stats'
import type { Plan, PlanIssue } from './types'

const DAY_MS = 86_400_000
/** Sorts before every real day, for an issue GitHub gave no date for */
const BEFORE_ALL = '0000-00-00'

export type DaySeries = {
  /** The days, `yyyy-mm-dd` on the site's calendar, oldest first and ending today */
  days: string[]
  /** Issues finished on each day */
  finished: number[]
  /** Issues finished by the end of each day, those before the first day included */
  doneTotal: number[]
  /** Issues open at the end of each day */
  open: number[]
}

/** The last `count` days on the site's calendar, oldest first, ending today (whatever the clock in UTC says) */
export function lastDays(now: Date, count: number): string[] {
  const today = Date.parse(siteDate(now))
  return Array.from({ length: count }, (_, i) =>
    new Date(today - (count - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  )
}

/**
 * How a group of issues moved over the last `count` days: finished per day, the running total
 * done and how many were open when each day ended. An issue decided against is in none of them;
 * one with no open date counts as open from before the first day, so a gap in what GitHub gave
 * never makes the open count dip. A quiet day is zero, never missing.
 */
export function groupSeries(issues: PlanIssue[], now: Date, count: number): DaySeries {
  const days = lastDays(now, count)
  const counted = issues
    .filter((issue) => issue.state !== 'not-planned')
    .map((issue) => ({
      created: issue.createdAt ? siteDate(new Date(issue.createdAt)) : BEFORE_ALL,
      closed:
        issue.state !== 'done'
          ? null
          : issue.closedAt
            ? siteDate(new Date(issue.closedAt))
            : BEFORE_ALL,
    }))

  return {
    days,
    finished: days.map((day) => counted.filter(({ closed }) => closed === day).length),
    doneTotal: days.map(
      (day) => counted.filter(({ closed }) => closed !== null && closed <= day).length,
    ),
    open: days.map(
      (day) =>
        counted.filter(({ created, closed }) => created <= day && (closed === null || closed > day))
          .length,
    ),
  }
}

/** The same figures for the whole plan: every issue it shows, the projects themselves left out */
export function planSeries(plan: Plan, now: Date, count: number): DaySeries {
  const epics = [...plan.milestones.flatMap((m) => m.epics), ...plan.unscheduled]
  return groupSeries(
    epics.flatMap((epic) => epic.children),
    now,
    count,
  )
}

const WEEK_DAYS = 7

/** The last seven days of finished work for a group of issues, and whether none was finished */
export function weekActivity(issues: PlanIssue[], now: Date) {
  const { days, finished } = groupSeries(issues, now, WEEK_DAYS)
  return { days, finished, quiet: finished.every((count) => count === 0) }
}
