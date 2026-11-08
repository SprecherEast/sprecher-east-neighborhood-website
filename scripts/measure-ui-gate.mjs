/**
 * Measures the UI-change detector (#868) on merged pull requests: for each of the last N it prints
 * whether the gate would have fired and which files made it, plus the other changed files, so a
 * person can judge from the diff whether a visual change really happened (false alarm), and spot
 * the visual changes the gate missed. Needs the `gh` CLI signed in. Read-only.
 *
 *   node scripts/measure-ui-gate.mjs [owner/repo] [count]    one JSON object per line
 */
import { listAll, pullFiles } from '../.github/scripts/e2e-gate.mjs'
import { uiChanges } from './behavior-change.mjs'

const repo = process.argv[2] ?? 'boulaajaj/sprecher-east-neighborhood-website'
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
  const ui = uiChanges(files)
  const flagged = new Set(ui.map((f) => f.filename))
  console.log(
    JSON.stringify({
      number: pr.number,
      title: pr.title,
      mergedAt: pr.merged_at,
      flagged: ui.length > 0,
      ui: ui.map((f) => f.filename),
      others: files.filter((f) => !flagged.has(f.filename)).map((f) => f.filename),
    }),
  )
}
