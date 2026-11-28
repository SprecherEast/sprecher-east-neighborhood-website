/**
 * What keeps an issue out of Ready, defined once for every planner script (#1435): the two marker
 * labels, the blockers they and the issue check raise, and the one step that asks the issue check.
 * It imports no planner script, so the rule, the facts, the report and the app can all use it.
 */
import { issueProblems, skipReason } from '../.github/scripts/issue-policy.mjs'

/** Marker labels from `.github/label-policy.json`; a test keeps these names in step with it. */
export const READY_LABEL = 'ready'
export const OWNER_LABEL = 'needs owner'

/** What keeps an issue out of Ready: it waits for the owner, or a rule of the issue check fails. */
export function readyBlockers(issue) {
  const waits = issue.labels.includes(OWNER_LABEL) ? [OWNER_LABEL] : []
  return [...waits, ...(issue.problems ?? [])]
}

/** The issue-check rules the issue fails: none for an issue the check skips. */
export const issueCheckProblems = (issue, policy) =>
  skipReason(issue) ? [] : issueProblems(issue, policy)
