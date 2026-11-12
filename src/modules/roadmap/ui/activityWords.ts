import type { PlanActivity } from '../domain/activity'

type StepLabel = PlanActivity['stepLabel']

const STEP_WORD = { weeks: 'week', months: 'month', years: 'year' } as const

/** What the newest step says in words, so an activity picture is never the only signal */
export function recentWords(series: number[], done: number, step: StepLabel): string {
  if (done === 0) return 'Nothing finished yet'
  const latest = series.at(-1) ?? 0
  return latest > 0 ? `${latest} finished this ${STEP_WORD[step]}` : `Quiet this ${STEP_WORD[step]}`
}

/** The text equivalent of an activity picture: every value, oldest first */
export function activityLabel(series: number[], step: StepLabel): string {
  return `Finished each ${STEP_WORD[step]}, oldest first: ${series.join(', ')}`
}
