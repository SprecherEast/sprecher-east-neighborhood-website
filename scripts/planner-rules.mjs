/**
 * The planner app's rule for sprints (#903): work that finished in a sprint keeps that sprint, so
 * the sprint's history and burndown stay true. Only unfinished work moves forward. GitHub has no
 * setting that locks a finished card, so the app's code checks this before it changes a sprint.
 * Cards are shaped like `gh project item-list --format json` rows: a `status` text, an optional
 * `sprint` ({ title, startDate, duration }) and `content` without the issue's open or closed state,
 * so a finished card is one whose status is Done.
 */
import { pathToFileURL } from 'node:url'

const DAY_MS = 86_400_000

/** Finished means the Done status. */
const isFinished = (item) => item.status === 'Done'

const isReadableSprint = (sprint) => Boolean(sprint.startDate) && Number.isFinite(sprint.duration)

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

/** Counts for the check's log, including what could not be read. */
export function summarizeBoard(items, today) {
  const withSprint = items.filter((item) => item.sprint)
  return {
    cards: items.length,
    withSprint: withSprint.length,
    protectedCards: withSprint.filter(isFinished).length,
    inPastSprint: withSprint.filter((item) => isPastSprint(item.sprint, today)).length,
    withoutStatus: items.filter((item) => typeof item.status !== 'string').length,
    malformedSprints: withSprint.filter((item) => !isReadableSprint(item.sprint)).length,
  }
}

/** What would make the rule blind: no cards, no readable status anywhere, or a sprint it cannot read. */
export function boardProblems(summary) {
  const problems = []
  if (summary.cards === 0) problems.push('The board has no cards.')
  else if (summary.withoutStatus === summary.cards) {
    problems.push('No card has a readable status, so the card shape may have changed.')
  }
  if (summary.malformedSprints > 0) {
    problems.push(
      `${summary.malformedSprints} card(s) have a sprint without a start date or length.`,
    )
  }
  return problems
}

// Command line: read `gh project item-list --format json` on stdin, print the summary, and fail
// when the board cannot be read the way the rule needs.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) input += chunk
  const summary = summarizeBoard(
    JSON.parse(input).items ?? [],
    new Date().toISOString().slice(0, 10),
  )
  console.log(JSON.stringify(summary))
  const problems = boardProblems(summary)
  for (const problem of problems) console.error(`::error::${problem}`)
  if (problems.length > 0) process.exit(1)
}
