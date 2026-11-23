/**
 * What a board card should say, worked out from facts GitHub records (#1425, the reliable-board
 * pattern on #890). One pure function: it reads facts and returns `{ status, reason, flags }`, and
 * never acts on them. The first rule that matches wins:
 *
 * 1. the issue is closed: Done;
 * 2. an open pull request closes it: In review;
 * 3. it is claimed (assigned, and a `### [STEP]` comment names a branch): In progress. There is no
 *    timer; a claimed issue that goes quiet is still In progress;
 * 4. it has the `ready` label, passes the issue check and has no `needs owner`: Ready;
 * 5. anything else that is open: Backlog.
 *
 * An epic never takes its status from its assignee; it follows its children. Flags name provable
 * problems only. This file reads nothing and writes nothing, so a test can prove it.
 */

import { READY_LABEL, readyBlockers } from './planner-board.mjs'
import { isEpic } from '../.github/scripts/issue-policy.mjs'
import { STATUS } from './planner-config.mjs'

export const FLAGS = {
  neverStarted:
    'Assigned but never started: no claim comment names a branch and no pull request exists.',
  mergedStillOpen:
    'A merged pull request declared it closes this issue, but the issue is still open.',
  epicChildrenDone: 'Every child of this epic is closed, but the epic is still open.',
  openUnderClosed: 'This issue is open, but its parent is closed.',
}

/** The branch a `### [STEP]` claim comment names (`Branch: \`name\``), or null. */
export function claimBranch(comments) {
  for (const { body = '' } of [...comments].reverse()) {
    if (!/^###\s*\[STEP\]/.test(body)) continue
    const match = /\bBranch\b[:*\s]*`([^`\s]+)`/i.exec(body)
    if (match) return match[1]
  }
  return null
}

const ACTIVE = new Set([STATUS.inProgress, STATUS.inReview])

function epicStatus({ children }) {
  if (children.some((child) => ACTIVE.has(child.status))) {
    return {
      status: STATUS.inProgress,
      reason: 'An epic follows its children, and one of them is under way.',
    }
  }
  return {
    status: STATUS.backlog,
    reason: 'An epic follows its children, and none of them is under way.',
  }
}

function flagsFor(facts, epic) {
  const flags = []
  const { assignees, claimBranch: branch, pullRequests, mergedPullRequests } = facts
  if (facts.state !== 'open') return flags
  if (!epic && assignees.length > 0 && !branch && pullRequests === 0) {
    flags.push(FLAGS.neverStarted)
  }
  if (mergedPullRequests > 0) flags.push(FLAGS.mergedStillOpen)
  if (
    epic &&
    facts.children.length > 0 &&
    facts.children.every((child) => child.status === STATUS.done)
  ) {
    flags.push(FLAGS.epicChildrenDone)
  }
  if (facts.parent?.state === 'closed') flags.push(FLAGS.openUnderClosed)
  return flags
}

/**
 * @param {object} facts
 * @param {'open'|'closed'} facts.state
 * @param {string[]} facts.labels
 * @param {string[]} facts.assignees
 * @param {string[]} facts.problems  rules of the issue check the issue fails
 * @param {string|null} facts.claimBranch  from `claimBranch(comments)`
 * @param {number} facts.openPullRequests  open pull requests that close the issue
 * @param {number} facts.mergedPullRequests  merged pull requests that declared they close it (closing reference or closing keyword)
 * @param {number} facts.pullRequests  every pull request in any state that closes or declares it closes it
 * @param {{status: string}[]} facts.children  an epic's children, each with the status the rule gives
 * @param {{state: string}|null} facts.parent
 * @returns {{status: string, reason: string, flags: string[]}}
 */
export function boardStatus(facts) {
  const epic = isEpic(facts)
  const flags = flagsFor(facts, epic)
  const done = (status, reason) => ({ status, reason, flags })
  if (facts.state === 'closed') return done(STATUS.done, 'The issue is closed.')
  if (facts.openPullRequests > 0) {
    return done(STATUS.inReview, 'An open pull request closes this issue.')
  }
  if (epic) {
    const { status, reason } = epicStatus(facts)
    return done(status, reason)
  }
  if (facts.assignees.length > 0 && facts.claimBranch) {
    return done(
      STATUS.inProgress,
      `It is assigned and the claim names branch ${facts.claimBranch}.`,
    )
  }
  const blockers = readyBlockers(facts)
  if (facts.labels.includes(READY_LABEL) && blockers.length === 0) {
    return done(
      STATUS.ready,
      'It has the ready label, passes the issue check and waits for no one.',
    )
  }
  const why = facts.labels.includes(READY_LABEL)
    ? `It has the ready label but is held back by ${blockers.join(', ')}.`
    : 'It is open, not claimed, and has no ready label.'
  return done(STATUS.backlog, why)
}
