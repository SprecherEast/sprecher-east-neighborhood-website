/**
 * The planner app's rule for sprints (#903): work that finished in a sprint keeps that sprint, so
 * the sprint's history and burndown stay true. Only unfinished work moves forward. GitHub has no
 * setting that locks a finished card, so the app's code checks this before it changes a sprint.
 * Cards are shaped like `gh project item-list --format json` rows.
 */
import { pathToFileURL } from 'node:url'

const DAY_MS = 86_400_000

/** Finished means the Done status or a closed issue. */
const isFinished = (item) => item.status === 'Done' || item.content?.state === 'CLOSED'

/** A sprint is past once its last day has gone (start date plus duration, in days). */
export function isPastSprint(sprint, today) {
  if (!sprint?.startDate) return false
  const end = Date.parse(sprint.startDate) + sprint.duration * DAY_MS
  return Date.parse(today) >= end
}

/** Whether the app may change a card's sprint, and why not. */
export function canChangeSprint(item) {
  if (item.sprint && isFinished(item)) {
    return { allowed: false, reason: 'Finished work keeps its sprint.' }
  }
  return { allowed: true, reason: '' }
}

/** Counts for the check's log, and proof the rule refuses every card it should protect. */
export function summarizeBoard(items, today) {
  const withSprint = items.filter((item) => item.sprint)
  const protectedCards = withSprint.filter(isFinished)
  return {
    cards: items.length,
    withSprint: withSprint.length,
    protectedCards: protectedCards.length,
    inPastSprint: withSprint.filter((item) => isPastSprint(item.sprint, today)).length,
    allProtectedRefused: protectedCards.every((item) => !canChangeSprint(item).allowed),
  }
}

// Command line: read `gh project item-list --format json` on stdin, print the summary, and fail
// when the rule would let a finished card move.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) input += chunk
  const summary = summarizeBoard(
    JSON.parse(input).items ?? [],
    new Date().toISOString().slice(0, 10),
  )
  console.log(JSON.stringify(summary))
  if (!summary.allProtectedRefused) process.exit(1)
}
