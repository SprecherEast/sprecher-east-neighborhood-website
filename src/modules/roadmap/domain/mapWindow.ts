import { lastDays } from './series'
import { siteDate } from './stats'

/*
 * Which days the activity map shows. Step 0 is the rolling four weeks ending today; step 1 is the
 * whole previous calendar month, step 2 the month before it, and so on. Days are `yyyy-mm-dd` on
 * the site's calendar, oldest first.
 */

/** The days the default view shows: four whole weeks */
export const ROLLING_DAYS = 28

export type MapWindow = {
  days: string[]
  /** What the view is called: "Last four weeks" or "October 2026" */
  title: string
}

/** A month as a count since year 0, so months can be stepped over a year end */
const monthIndex = (day: string) => {
  const [year, month] = day.split('-').map(Number)
  return year * 12 + (month - 1)
}

export function mapWindow(now: Date, step: number): MapWindow {
  if (step <= 0) return { days: lastDays(now, ROLLING_DAYS), title: 'Last four weeks' }
  const index = monthIndex(siteDate(now)) - step
  const year = Math.floor(index / 12)
  const month = index % 12
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    days: Array.from({ length }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`),
    title: new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  }
}

/** The furthest step back that still holds data, given the first day any issue has; 0 when there is none */
export function earliestStep(now: Date, since: string | null): number {
  if (!since) return 0
  return Math.max(0, monthIndex(siteDate(now)) - monthIndex(since))
}
