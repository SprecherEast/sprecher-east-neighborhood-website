/**
 * Keeps the board in step with the work, as the planner app (#941, #1089, #1435). When an event
 * concerns an issue, the app gathers that issue's facts, asks the one status rule
 * (`planner-status.mjs`, the same the report uses) what its card should say, and sets the card to
 * that. Only the issue the event concerns is written: an epic's children are read, never written.
 * Every move writes the reason first, in one "Board status" comment edited in place
 * (`planner-comment.mjs`, fixed sentences only). An event never moves a card backwards unless the
 * planner set the card's current status; it holds the move and says so in the comment, and a manual
 * run for the issue applies it. Flags the rule raises stay in the comment and the report: they never
 * move a card, change a label or change an assignee. The app writes the Status field and that comment
 * only.
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
import { boardStatusComment } from './planner-comment.mjs'
import { decideChanges, settleCards } from './planner-status.mjs'

/** Events that put the issue's card on the board even when the issue is already closed. */
const CARD_ACTIONS = new Set(['opened', 'reopened', 'assigned', 'sync'])
/** The most issues one event reads (an epic, its children, theirs): more than that is not read. */
const MAX_CARDS = 200

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
function loadCards({ run, policy, repository, number, project, appSlug }) {
  const cards = []
  const seen = new Set()
  const onBoard = (child) =>
    child.projects.some((entry) => entry.owner === project.org && entry.number === project.number)
  for (let queue = [{ repository, number }]; queue.length > 0; ) {
    const next = queue.shift()
    const card = factsFromIssue(readIssue(run, next.repository, next.number), policy, appSlug)
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

/** Writes the issue's one Board status comment: edits the planner's own, or posts the first. */
function writeComment(run, repository, number, body, existing) {
  if (existing?.body === body) return
  const path = existing
    ? `repos/${repository}/issues/comments/${existing.id}`
    : `repos/${repository}/issues/${number}/comments`
  run(['api', '-X', existing ? 'PATCH' : 'POST', path, '-f', `body=${body}`])
}

/** Brings the card of the one issue the event concerns in line with the rule; returns what it did. */
export function moveCard({ run, env, policy, log = console.log }) {
  const {
    REPO,
    ISSUE,
    ACTION = 'sync',
    ORG = DEFAULT_ORG,
    PROJECT = DEFAULT_PROJECT,
    PLANNER_APP_SLUG: appSlug,
  } = env
  if (!/^\d+$/.test(ISSUE ?? '')) throw new Error('ISSUE must be an issue number.')
  if (!appSlug) throw new Error('PLANNER_APP_SLUG must name the planner app.')
  const project = { org: ORG, number: Number(PROJECT) }
  const cards = loadCards({
    run,
    policy,
    repository: REPO,
    number: Number(ISSUE),
    project,
    appSlug,
  })
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
  const item = { status: data.node.status?.name ?? null }
  const changes = decideChanges({ result, item, action: ACTION, plannerSet: root.facts.plannerSet })
  log(`#${ISSUE} ${ACTION}: ${JSON.stringify(changes)}`)
  const from = item.status ?? 'no status'
  const write = (options) =>
    writeComment(
      run,
      REPO,
      ISSUE,
      boardStatusComment({ from, result, ...options }),
      root.facts.statusComment,
    )
  if (changes.held) {
    write({ held: true, set: root.facts.plannerSet })
    return changes
  }
  if (!changes.status) return changes

  const board = JSON.parse(run(graphqlArgs(BOARD_QUERY, { org: ORG }, { n: PROJECT }))).data
    .organization.projectV2
  const option = board.status.options.find((entry) => entry.name === changes.status)
  if (!option) throw new Error(`The board has no "${changes.status}" status.`)
  // The reason comes first: a card never moves without one. It says what the rule gives and why,
  // so it stays true if the edit fails, and the next event writes it again
  write({})
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
  return changes
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { REPO, ISSUE, ACTION, ORG, PROJECT, PLANNER_APP_SLUG } = process.env
  moveCard({
    run: runGh,
    env: { REPO, ISSUE, ACTION, ORG, PROJECT, PLANNER_APP_SLUG },
    policy: readPolicy(),
  })
}
