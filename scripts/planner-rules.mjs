/**
 * The planner app's check of the board it reads: it fails when the board cannot be read the way the
 * status rule needs, so the rule is never blind. Cards are shaped like `gh project item-list
 * --format json` rows, with a `status` text.
 */
import { pathToFileURL } from 'node:url'

/** Counts for the check's log, including what could not be read. */
export function summarizeBoard(items) {
  return {
    cards: items.length,
    withoutStatus: items.filter((item) => typeof item.status !== 'string').length,
  }
}

/** What would make the rule blind: no cards, or no readable status anywhere. */
export function boardProblems(summary) {
  const problems = []
  if (summary.cards === 0) problems.push('The board has no cards.')
  else if (summary.withoutStatus === summary.cards) {
    problems.push('No card has a readable status, so the card shape may have changed.')
  }
  return problems
}

// Command line: read `gh project item-list --format json` on stdin, print the summary, and fail
// when the board cannot be read the way the rule needs.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) input += chunk
  const summary = summarizeBoard(JSON.parse(input).items ?? [])
  console.log(JSON.stringify(summary))
  const problems = boardProblems(summary)
  for (const problem of problems) console.error(`::error::${problem}`)
  if (problems.length > 0) process.exit(1)
}
