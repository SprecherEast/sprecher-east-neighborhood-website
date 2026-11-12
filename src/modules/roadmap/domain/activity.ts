import { siteDate } from './stats'
import type { PlanIssue, PlanMilestone } from './types'

const DAY_MS = 86_400_000
const DAYS_PER_WEEK = 7

/**
 * How the plan page shows activity over time. One rule picks the time step for every mission,
 * so tiles are always comparable: weeks, unless fewer than half of the last few weeks are busy,
 * then months, and years when the months are sparse too. A bucket is busy once it holds
 * `busyMin` finished issues.
 */
export const ACTIVITY = {
  /** Finished issues a week, month or year needs to count as busy */
  busyMin: 3,
  /** How many buckets each step shows, newest last */
  points: { week: 8, month: 6, year: 3 },
} as const

export type ActivityStep = keyof typeof ACTIVITY.points

const STEP_LABELS: Record<ActivityStep, 'weeks' | 'months' | 'years'> = {
  week: 'weeks',
  month: 'months',
  year: 'years',
}

/** Months and years are counted on the site's calendar, so a late-evening close lands on its local day */
const siteYearMonth = (iso: string) => {
  const [year, month] = siteDate(new Date(iso)).split('-').map(Number)
  return { year, month }
}

/** How many whole steps before `now` a time falls, or null when it is in the future or outside the window */
function stepsBack(iso: string, step: ActivityStep, now: Date): number | null {
  const window = ACTIVITY.points[step]
  let back: number
  if (step === 'week') {
    const ageDays = (now.getTime() - new Date(iso).getTime()) / DAY_MS
    back = ageDays < 0 ? -1 : Math.floor(ageDays / DAYS_PER_WEEK)
  } else {
    const then = siteYearMonth(iso)
    const current = siteYearMonth(now.toISOString())
    back =
      step === 'year'
        ? current.year - then.year
        : current.year * 12 + current.month - (then.year * 12 + then.month)
  }
  return back >= 0 && back < window ? back : null
}

/** Finished issues per step, oldest first and newest last, always `ACTIVITY.points[step]` long */
export function bucketCounts(closedAts: string[], step: ActivityStep, now: Date): number[] {
  const window = ACTIVITY.points[step]
  const counts = Array.from({ length: window }, () => 0)
  for (const iso of closedAts) {
    const back = stepsBack(iso, step, now)
    if (back !== null) counts[window - 1 - back] += 1
  }
  return counts
}

const isBusyEnough = (counts: number[]) =>
  counts.filter((count) => count >= ACTIVITY.busyMin).length * 2 >= counts.length

/** Weeks while they are mostly busy, then months, then years; with no activity at all, weeks */
export function pickActivityStep(closedAts: string[], now: Date): ActivityStep {
  if (isBusyEnough(bucketCounts(closedAts, 'week', now))) return 'week'
  if (isBusyEnough(bucketCounts(closedAts, 'month', now))) return 'month'
  return closedAts.length === 0 ? 'week' : 'year'
}

export type MissionActivity = {
  milestoneNumber: number
  /** Finished issues per step, oldest first */
  series: number[]
  /** The latest close or change of any of its issues; null when none has a date */
  latestAt: string | null
}

export type PlanActivity = {
  step: ActivityStep
  stepLabel: 'weeks' | 'months' | 'years'
  /** The tallest bucket of any mission, so every tile draws on the same scale; at least 1 */
  max: number
  /** Missions with the latest activity first */
  missions: MissionActivity[]
}

/** The times the finished issues of a mission were closed; issues decided against don't count */
const closedTimes = (issues: PlanIssue[]) =>
  issues.flatMap((i) => (i.state === 'done' && i.closedAt ? [i.closedAt] : []))

/** Every time something happened to a mission's issues: a finished issue's close, or any issue's last change */
const activityTimes = (issues: PlanIssue[]) => [
  ...closedTimes(issues),
  ...issues.flatMap((i) => (i.updatedAt ? [i.updatedAt] : [])),
]

/** The latest of some times, compared as instants and returned as it was written */
const latest = (times: string[]) =>
  times.reduce<string | null>((a, t) => (a === null || Date.parse(t) > Date.parse(a) ? t : a), null)

/**
 * Each mission's activity, ordered by its latest activity (most recent first; missions whose
 * issues carry no date come last, then by milestone number so ties stay put). Latest activity is the later of
 * an issue's close and its last change on GitHub, so an edit or a comment counts; the series
 * counts finished issues only. The first mission is the one the page features.
 */
export function planActivity(milestones: PlanMilestone[], now: Date): PlanActivity {
  const perMission = milestones.map((m) => ({
    number: m.number,
    issues: m.epics.flatMap((epic) => epic.children),
  }))
  const step = pickActivityStep(
    perMission.flatMap((m) => closedTimes(m.issues)),
    now,
  )
  const missions = perMission
    .map<MissionActivity>((m) => ({
      milestoneNumber: m.number,
      series: bucketCounts(closedTimes(m.issues), step, now),
      latestAt: latest(activityTimes(m.issues)),
    }))
    .sort((a, b) => {
      const byTime =
        (b.latestAt === null ? -Infinity : Date.parse(b.latestAt)) -
        (a.latestAt === null ? -Infinity : Date.parse(a.latestAt))
      return Number.isNaN(byTime) || byTime === 0 ? a.milestoneNumber - b.milestoneNumber : byTime
    })
  return {
    step,
    stepLabel: STEP_LABELS[step],
    max: Math.max(1, ...missions.flatMap((m) => m.series)),
    missions,
  }
}
