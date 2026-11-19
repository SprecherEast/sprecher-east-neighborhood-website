/**
 * Measures the end-to-end gate (#868) on merged pull requests, as if none had an exemption: for each
 * of the last N it prints whether the gate would have run the browser tests, and why and which files made it, plus the other changed files, so a
 * person can judge from the diff whether a visual change really happened (false alarm), and spot
 * the visual changes the gate missed. Needs the `gh` CLI signed in. Read-only.
 *
 *   node scripts/measure-ui-gate.mjs [owner/repo] [count]    one JSON object per line
 */
import { e2eDecision, listAll, pullFiles } from '../.github/scripts/e2e-gate.mjs'

const repo = process.argv[2] ?? 'SprecherEast/sprecher-east-neighborhood-website'
const count = Number(process.argv[3] ?? 40)

const closed = listAll(`repos/${repo}/pulls?state=closed&sort=updated&direction=desc`, {
  limit: count * 3,
})
const merged = closed
  .filter((pr) => pr.merged_at)
  .sort((a, b) => b.merged_at.localeCompare(a.merged_at))
  .slice(0, count)

for (const pr of merged) {
  const files = pullFiles(repo, pr.number)
  const { run, reason, ui, flows } = e2eDecision({ event: 'pull_request', files, body: '' })
  const flagged = new Set([...ui, ...flows].map((f) => f.filename))
  console.log(
    JSON.stringify({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.merged_at,
      flagged: run,
      reason,
      ui: ui.map((f) => f.filename),
      flows: flows.map((f) => f.filename),
      others: files.filter((f) => !flagged.has(f.filename)).map((f) => f.filename),
    }),
  )
}
