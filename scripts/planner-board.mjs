/**
 * Keeps the board in step with the work, as the planner app (#941, #1089, #1435). When an event
 * concerns an issue, the app gathers that issue's facts, asks the one status rule
 * (`planner-status.mjs`, the same the report uses) what its card should say, and sets the card to
 * that. Only the issue the event concerns moves: an epic's children are read, never written. A move
 * to Backlog, Ready or In progress leaves the reason on the issue, in one "Board status" comment
 * that is edited in place; GitHub's own board workflows set In review and Done, and those need no
 * comment. Flags the rule raises stay in that comment and in the report: they never move a card,
 * change a label or change an assignee. The app writes the Status field and that comment only.
 *
 * The decision is pure and tested; `moveCard` reads and writes through a command runner, which the
 * command line below makes from `gh`, signed in as the app by the workflow.
 */
import { pathToFileURL } from 'node:url'

import {
  CARD_STATUS_FRAGMENT,
  ORG as DEFAULT_ORG,
  PROJECT as DEFAULT_PROJECT,
  STATUS,
  STATUS_FIELD,
} from './planner-config.mjs'
import {
  factsFromIssue,
  graphqlArgs,
  ISSUE_FIELDS,
  readClaimBranches,
  readPolicy,
  runGh,
  withRemoteBranch,
} from './planner-facts.mjs'
import { settleCards } from './planner-status.mjs'

/** Events that put the issue's card on the board even when the issue is already closed. */
const CARD_ACTIONS = new Set(['opened', 'reopened', 'assigned', 'sync'])
/** The most issues one event reads (an epic, its children, theirs): more than that is not read. */
const MAX_CARDS = 200
/** GitHub's own board workflows set these two, so a move to either leaves no comment. */
const BUILT_IN = new Set([STATUS.inReview, STATUS.done])

export const BOARD_STATUS_MARKER = '<!-- planner:board-status -->'

/** What to change on a card: `{ status? }`, empty when it already says what the rule gives. */
export function decideChanges({ result, item }) {
  return result.status === item.status ? {} : { status: result.status }
}

/** Whether a move to this status gets a comment: not the ones GitHub's own workflows set. */
export const needsComment = (status) => !BUILT_IN.has(status)

/** The one comment on the issue: the new status, where it came from and why. Fixed text only. */
export function boardStatusComment({ from, result }) {
  const flags = result.flags.map((flag) => `- ${flag}`)
  return [
    BOARD_STATUS_MARKER,
    `### Board status: ${result.status}`,
    '',
    `The planner moved this card from ${from} to ${result.status}. ${result.reason}`,
    ...(flags.length > 0
      ? ['', 'Flags (reported only, nothing was changed for them):', ...flags]
      : []),
  ].join('\n')
}

/** The comment this app keeps on an issue: a bot wrote it and it starts with the marker. */
export const findStatusComment = (comments) =>
  comments.find((entry) => entry.type === 'Bot' && entry.body.startsWith(BOARD_STATUS_MARKER)) ??
  null

const BOARD_QUERY = `query($org:String!,$n:Int!){organization(login:$org){projectV2(number:$n){id
    status:field(name:"${STATUS_FIELD}"){... on ProjectV2SingleSelectField{id options{id name}}}}}}`
const ISSUE_QUERY = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){
  issue(number:$number){${ISSUE_FIELDS}}}}`
const CARD_QUERY = `query($id:ID!){node(id:$id){... on ProjectV2Item{${CARD_STATUS_FRAGMENT}}}}`

function readIssue(run, repository, number) {
  const [owner, name] = repository.split('/')
  const { data } = JSON.parse(run(graphqlArgs(ISSUE_QUERY, { owner, name }, { number })))
  const issue = data?.repository?.issue
  if (!issue) throw new Error(`#${number} is not an issue of ${repository}.`)
  return issue
}

/**
 * The issue the event concerns and, for an open one, the open sub-issues that are on the board and
 * theirs in turn (an epic follows its children), as cards with their facts and remote branches.
 * Anything not read in full throws, so a guess never moves a card.
 */
function loadCards({ run, policy, repository, number, project }) {
  const cards = []
  const seen = new Set()
  const onBoard = (child) =>
    child.projects.some((entry) => entry.owner === project.org && entry.number === project.number)
  for (let queue = [{ repository, number }]; queue.length > 0; ) {
    const next = queue.shift()
    const card = factsFromIssue(readIssue(run, next.repository, next.number), policy)
    if (seen.has(card.key)) continue
    seen.add(card.key)
    cards.push(card)
    if (cards.length > MAX_CARDS) throw new Error(`More than ${MAX_CARDS} issues to read.`)
    if (card.facts.state !== 'open') continue
    for (const child of card.facts.subIssues) {
      if (child.state !== 'open' || !onBoard(child) || seen.has(child.key)) continue
      queue.push({
        repository: child.key.slice(0, child.key.lastIndexOf('#')),
        number: child.number,
      })
    }
  }
  const branches = new Map()
  for (const name of new Set(cards.map((card) => card.repository))) {
    readClaimBranches(run, name).forEach((branch, key) => branches.set(key, branch))
  }
  return cards.map((card) => withRemoteBranch(card, branches))
}

/** The comments on an issue as `{ id, type, body }`, every page. */
function readComments(run, repository, number) {
  const filter = '.[] | {id, type: .user.type, body}'
  const lines = run([
    'api',
    '--paginate',
    `repos/${repository}/issues/${number}/comments`,
    '--jq',
    filter,
  ])
  return lines
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function writeComment(run, repository, number, body) {
  const existing = findStatusComment(readComments(run, repository, number))
  const path = existing
    ? `repos/${repository}/issues/comments/${existing.id}`
    : `repos/${repository}/issues/${number}/comments`
  run(['api', '-X', existing ? 'PATCH' : 'POST', path, '-f', `body=${body}`])
}

/** Brings the card of the one issue the event concerns in line with the rule; returns what it did. */
export function moveCard({ run, env, policy, log = console.log }) {
  const { REPO, ISSUE, ACTION = 'sync', ORG = DEFAULT_ORG, PROJECT = DEFAULT_PROJECT } = env
  if (!/^\d+$/.test(ISSUE ?? '')) throw new Error('ISSUE must be an issue number.')
  const project = { org: ORG, number: Number(PROJECT) }
  const cards = loadCards({ run, policy, repository: REPO, number: Number(ISSUE), project })
  const root = cards[0]
  if (root.facts.state !== 'open' && !CARD_ACTIONS.has(ACTION)) {
    log(`#${ISSUE} is closed, so this change moves nothing.`)
    return {}
  }
  const result = settleCards(cards).get(root.key)

  const itemId = JSON.parse(
    run([
      'project',
      'item-add',
      PROJECT,
      '--owner',
      ORG,
      '--url',
      `https://github.com/${REPO}/issues/${ISSUE}`,
      '--format',
      'json',
    ]),
  ).id
  const { data } = JSON.parse(run(graphqlArgs(CARD_QUERY, { id: itemId })))
  if (!data?.node) throw new Error('Could not read the card, so it is left alone.')
  const item = { status: data.node.status?.name ?? STATUS.backlog }
  const changes = decideChanges({ result, item })
  log(`#${ISSUE} ${ACTION}: ${JSON.stringify(changes)}`)
  if (!changes.status) return changes

  const board = JSON.parse(run(graphqlArgs(BOARD_QUERY, { org: ORG }, { n: PROJECT }))).data
    .organization.projectV2
  const option = board.status.options.find((entry) => entry.name === changes.status)
  if (!option) throw new Error(`The board has no "${changes.status}" status.`)
  run([
    'project',
    'item-edit',
    '--id',
    itemId,
    '--project-id',
    board.id,
    '--field-id',
    board.status.id,
    '--single-select-option-id',
    option.id,
  ])
  if (needsComment(changes.status)) {
    writeComment(run, REPO, ISSUE, boardStatusComment({ from: item.status, result }))
  }
  return changes
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { REPO, ISSUE, ACTION, ORG, PROJECT } = process.env
  moveCard({
    run: runGh,
    env: { REPO, ISSUE, ACTION, ORG, PROJECT },
    policy: readPolicy(),
  })
}
