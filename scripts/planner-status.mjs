/**
 * What a board card should say, worked out from facts GitHub records (#1425, the reliable-board
 * pattern on #890). One pure function: it reads facts and returns `{ status, reason, flags }`, and
 * never acts on them. The first rule that matches wins:
 *
 * 1. the issue is closed: Done;
 * 2. an open pull request closes it: In review;
 * 3. it is claimed (assigned, and work has started: a `### [STEP]` comment names a branch, or a pull
 *    request in any state closes it or says it does, or a branch of the claim naming pattern
 *    exists on the remote): In progress. Assignment alone is not a start. There is no timer; a
 *    claimed issue that goes quiet is still In progress, and `needs owner` shows as a flag beside
 *    it;
 * 4. it has the `ready` label, passes the issue check and has no `needs owner`: Ready;
 * 5. anything else that is open: Backlog.
 *
 * An epic never takes its status from its assignee; it follows its children. Flags name provable
 * problems only. This file reads nothing and writes nothing, so a test can prove it.
 */

import { isEpic } from '../.github/scripts/issue-policy.mjs'
import { STATUS, STATUS_ORDER } from './planner-config.mjs'
import { OWNER_LABEL, READY_LABEL, readyBlockers } from './planner-ready.mjs'

export const FLAGS = {
  neverStarted:
    'Assigned but never started: no claim comment names a branch, no pull request closes this issue or says it does, and no branch of the claim naming pattern exists.',
  waitsForOwner: 'It is claimed and also waits for the owner, so it stays In progress.',
  mergedStillOpen:
    'A merged pull request declared it closes this issue, but the issue is still open.',
  epicChildrenDone: 'Every child of this epic is closed, but the epic is still open.',
  openUnderClosed: 'This issue is open, but its parent is closed.',
}

/**
 * The branch a `### [STEP]` claim comment names (`Branch: \`name\``), or null. Only a plain branch
 * name counts, so text a person put between the backticks never reaches a reason. The dispatch
 * brief's Branch line is read by this (a test reads the template).
 */
export function claimBranch(comments) {
  for (const { body = '' } of [...comments].reverse()) {
    if (!/^###\s*\[STEP\]/.test(body)) continue
    const match = /\bBranch\b[:*\s]*`([A-Za-z0-9._/-]+)`/i.exec(body)
    if (match) return match[1]
  }
  return null
}

/** The claim naming pattern, `agent/<role>/<issue>-<description>`, and the issue a branch names. */
const CLAIM_BRANCH = /^agent\/[a-z0-9-]+\/(\d+)-[A-Za-z0-9._-]+$/
export function issueOfBranch(name) {
  const match = CLAIM_BRANCH.exec(name)
  return match ? Number(match[1]) : null
}

/**
 * How work on the issue shows, in the order the reasons are given, or null when it has not started.
 * The reasons are fixed sentences: they are written to the issue, so nothing read from a comment or
 * a branch name goes into one.
 */
function startedBy(facts) {
  if (facts.claimBranch) return 'a claim comment names a branch'
  if (facts.pullRequests > 0) return 'a pull request closes it or says it does'
  if (facts.remoteBranch) return 'a branch of the claim naming pattern exists on the remote'
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
  if (facts.state !== 'open') return flags
  const claimed = !epic && facts.assignees.length > 0
  const started = Boolean(startedBy(facts))
  if (claimed && !started) flags.push(FLAGS.neverStarted)
  if (claimed && started && facts.labels.includes(OWNER_LABEL) && facts.openPullRequests === 0) {
    flags.push(FLAGS.waitsForOwner)
  }
  if (facts.mergedPullRequests > 0) flags.push(FLAGS.mergedStillOpen)
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
 * @param {string|null} facts.remoteBranch  a branch of the claim naming pattern for the issue on the remote
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
  const started = startedBy(facts)
  if (facts.assignees.length > 0 && started) {
    return done(STATUS.inProgress, `It is assigned and ${started}.`)
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

/**
 * Settles a set of cards, each `{ key, facts }` with `facts.subIssues` as `{ key, state }`, and
 * returns a Map from key to `{ status, reason, flags }`. Epics are worked out after the other
 * issues, because they follow their children, and again for as many rounds as there are epics so an
 * epic under an epic is settled before its parent. A sub-issue that is not among the cards (not on
 * the board) counts as Backlog; issues are keyed by repository and number. The report and the
 * event moves both decide through this, so they cannot disagree.
 */
export function settleCards(cards) {
  const statuses = new Map()
  const results = new Map()
  const work = ({ key, facts }) => {
    const children = (facts.subIssues ?? []).map((child) => ({
      status: child.state === 'closed' ? STATUS.done : (statuses.get(child.key) ?? STATUS.backlog),
    }))
    const result = boardStatus({ ...facts, children })
    statuses.set(key, result.status)
    results.set(key, result)
  }
  const epics = cards.filter((card) => isEpic(card.facts))
  cards.filter((card) => !isEpic(card.facts)).forEach(work)
  for (let round = 0; round <= epics.length; round += 1) epics.forEach(work)
  return results
}

/** Whether a move goes to an earlier column. A card with no status is before every column. */
export function isBackwards(from, to) {
  const [fromIndex, toIndex] = [STATUS_ORDER.indexOf(from), STATUS_ORDER.indexOf(to)]
  return fromIndex >= 0 && toIndex >= 0 && toIndex < fromIndex
}

/**
 * What to do to a card: `{ status }` to set it, `{ held }` for a backward move that waits for the
 * owner, `{}` for nothing. An event never moves a card backwards unless the planner itself set the
 * card's current status (`plannerSet`); a manual run (`sync`) for the issue is the owner confirming
 * the move, so it applies any.
 */
export function decideChanges({ result, item, action, plannerSet = null }) {
  if (result.status === item.status) return {}
  const held =
    isBackwards(item.status, result.status) && action !== 'sync' && plannerSet !== item.status
  return held ? { held: result.status } : { status: result.status }
}
