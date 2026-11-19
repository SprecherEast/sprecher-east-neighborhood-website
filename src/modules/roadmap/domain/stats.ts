import { SITE_TIMEZONE } from '@/platform/lib/timezone'

import type { Plan, PlanIssue } from './types'

/** What "recently" means on the page, in days */
export const RECENT_DAYS = { week: 7 } as const

const DAY_MS = 86_400_000

export type PlanStats = {
  open: number
  done: number
}

const doneWithin = (issues: PlanIssue[], days: number, now: Date) =>
  issues.filter(
    (i) =>
      i.state === 'done' &&
      i.closedAt !== null &&
      now.getTime() - new Date(i.closedAt).getTime() <= days * DAY_MS,
  ).length

export type IssueProgress = {
  done: number
  open: number
  /** Done plus open: an issue decided against counts as neither */
  total: number
  percent: number
  doneThisWeek: number
}

/** How far along a group of issues is, for a progress bar and the words beside it */
export function issueProgress(issues: PlanIssue[], now: Date): IssueProgress {
  const done = issues.filter((i) => i.state === 'done').length
  const open = issues.filter((i) => i.state === 'open').length
  const total = done + open
  return {
    done,
    open,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    doneThisWeek: doneWithin(issues, RECENT_DAYS.week, now),
  }
}

/** A date as `yyyy-mm-dd` on the site's calendar, whatever the server's clock zone */
export const siteDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TIMEZONE }).format(date)

/**
 * Whole days from today to a milestone's due date (negative when it has passed). Today is the
 * calendar date in the site timezone, and a due date is a day, stored as midnight UTC, so the clock
 * time never moves the answer.
 */
export function dueIn(dueOn: string, now: Date): number {
  return Math.round((Date.parse(dueOn.slice(0, 10)) - Date.parse(siteDate(now))) / DAY_MS)
}

/**
 * How many issues the plan shows, open and done (screened ones are never in them). An issue
 * decided against is in neither count.
 */
export function planStats(plan: Plan, now: Date): PlanStats {
  const epics = [...plan.milestones.flatMap((m) => m.epics), ...plan.unscheduled]
  const issues = epics.flatMap((epic) => epic.children)
  const { open, done } = issueProgress(issues, now)

  return { open, done }
}
