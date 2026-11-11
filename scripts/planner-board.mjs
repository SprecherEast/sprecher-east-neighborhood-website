/**
 * Keeps the board in step with the work, as the planner app (#941, #1089). An agent changes the
 * issue and the card follows:
 *
 * - opened or reopened: the card joins the sprint that is running;
 * - assigned, which is how work is claimed: the card also becomes In progress;
 * - the `ready` label: a Backlog card becomes Ready, unless the issue waits for the owner
 *   (`needs owner`) or fails the issue check (the rules behind `needs grooming`, run here on the
 *   issue itself, because the check's own label changes start no workflow). Removing the label,
 *   or either blocker appearing, moves a Ready card back to Backlog.
 *
 * GitHub's own board rules already set In review and Done. Finished work keeps its sprint
 * (`planner-rules.mjs`), and a card never moves back from In progress, In review or Done. The
 * decision is pure and tested; the command line below reads and writes the board with `gh`,
 * signed in as the app by the workflow.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { issueProblems, skipReason } from '../.github/scripts/issue-policy.mjs'
import { canChangeSprint } from './planner-rules.mjs'

const DAY_MS = 86_400_000
const SPRINT_ACTIONS = new Set(['opened', 'reopened', 'assigned'])
const NO_BACKWARDS = new Set(['In review', 'Done'])
/** Marker labels from `.github/label-policy.json`; a test keeps these names in step with it. */
export const READY_LABEL = 'ready'
export const OWNER_LABEL = 'needs owner'
const NO_ISSUE = { state: 'open', labels: [], assignees: [], problems: [], readyRemoved: false }

/** The sprint whose days contain `today` (a yyyy-mm-dd date), if one is running. */
export function findCurrentSprint(iterations, today) {
  const day = Date.parse(today)
  return iterations.find((sprint) => {
    const start = Date.parse(sprint.startDate)
    return day >= start && day < start + sprint.duration * DAY_MS
  })
}

/** What keeps an issue out of Ready: it waits for the owner, or a rule of the issue check fails. */
export function readyBlockers(issue) {
  const waits = issue.labels.includes(OWNER_LABEL) ? [OWNER_LABEL] : []
  return [...waits, ...(issue.problems ?? [])]
}

const isReady = (issue) => issue.labels.includes(READY_LABEL) && readyBlockers(issue).length === 0

/**
 * A manual run (`sync`) treats an assigned issue as claimed. A label event never does: issues
 * assigned before the app existed would all jump to In progress the first time a label changed.
 */
const isClaim = (action, issue) =>
  action === 'assigned' ||
  (action === 'sync' && issue.state === 'open' && issue.assignees.length > 0)

/**
 * Both directions read the issue as it is now, so a run GitHub dropped is caught up by the next
 * one. A Ready card without the label is moved back only when the label was removed (this event,
 * or the issue's history) or on a manual run, because cards moved to Ready by hand before the
 * label existed never carried it.
 */
function statusFor({ action, label, issue, status }) {
  if (issue.state !== 'open' || NO_BACKWARDS.has(status)) return status
  if (isClaim(action, issue)) return 'In progress'
  if (status === 'Backlog' && isReady(issue)) return 'Ready'
  if (status !== 'Ready' || isReady(issue)) return status
  const labelRemoved = issue.readyRemoved || (action === 'unlabeled' && label === READY_LABEL)
  const demote = readyBlockers(issue).length > 0 || labelRemoved || action === 'sync'
  return demote ? 'Backlog' : status
}

/** What to change on a card: `{ status?, sprintId? }`, empty when it is already right. */
export function decideChanges({ action, label, issue = NO_ISSUE, item, current }) {
  const changes = {}
  const status = statusFor({ action, label, issue, status: item.status })
  if (status !== item.status) changes.status = status
  const joinsSprint = SPRINT_ACTIONS.has(action) || isClaim(action, issue)
  const inCurrent = item.sprint?.id === current?.id
  if (joinsSprint && current && !inCurrent && canChangeSprint(item).allowed) {
    changes.sprintId = current.id
  }
  return changes
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim()
const json = (...args) => JSON.parse(gh(...args))

function boardFields(org, number) {
  const query = `query($org:String!,$n:Int!){organization(login:$org){projectV2(number:$n){id
    status:field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}
    sprint:field(name:"Sprint"){... on ProjectV2IterationField{id configuration{iterations{id title startDate duration}}}}}}}`
  const { data } = json(
    'api',
    'graphql',
    '-f',
    `query=${query}`,
    '-F',
    `org=${org}`,
    '-F',
    `n=${number}`,
  )
  return data.organization.projectV2
}

const POLICY = new URL('../.github/label-policy.json', import.meta.url)

/**
 * The issue as the decision needs it: open or closed, label names, who it is assigned to, and the
 * issue-check rules it fails. Its text only goes through those pure functions, never into a command.
 */
function readIssue(repo, number) {
  const issue = json('api', `repos/${repo}/issues/${number}`)
  const policy = JSON.parse(readFileSync(POLICY, 'utf8'))
  return {
    state: issue.state,
    labels: issue.labels.map((entry) => entry.name),
    assignees: issue.assignees.map((entry) => entry.login),
    problems: skipReason(issue) ? [] : issueProblems(issue, policy),
    readyRemoved: false,
  }
}

/** Whether the `ready` label was ever taken off this issue, from its history. */
function readyWasRemoved(repo, number) {
  const filter = `[.[] | select(.event == "unlabeled" and .label.name == "${READY_LABEL}")] | length`
  const counts = gh('api', '--paginate', `repos/${repo}/issues/${number}/events`, '-q', filter)
  return counts.split('\n').some((count) => Number(count) > 0)
}

function run() {
  const { REPO, ISSUE, ACTION = 'sync', LABEL, ORG = 'SprecherEast', PROJECT = '1' } = process.env
  if (!/^\d+$/.test(ISSUE ?? '')) throw new Error('ISSUE must be an issue number.')
  const url = `https://github.com/${REPO}/issues/${ISSUE}`
  const issue = readIssue(REPO, ISSUE)
  if (issue.state !== 'open' && !SPRINT_ACTIONS.has(ACTION) && ACTION !== 'sync') {
    console.log(`#${ISSUE} is closed, so this change moves nothing.`)
    return
  }
  const blockers = readyBlockers(issue)
  if (issue.labels.includes(READY_LABEL) && blockers.length > 0) {
    console.log(
      `::warning::#${ISSUE} has "${READY_LABEL}" but is not Ready: ${blockers.join('; ')}`,
    )
  }
  const board = boardFields(ORG, PROJECT)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const current = findCurrentSprint(board.sprint?.configuration?.iterations ?? [], today)
  if (!current) console.log('::warning::No sprint is running today, so the sprint is left alone.')

  const itemId = json(
    'project',
    'item-add',
    PROJECT,
    '--owner',
    ORG,
    '--url',
    url,
    '--format',
    'json',
  ).id
  const item = cardState(itemId)
  if (item.status === 'Ready' && !issue.labels.includes(READY_LABEL)) {
    issue.readyRemoved = readyWasRemoved(REPO, ISSUE)
  }
  const changes = decideChanges({ action: ACTION, label: LABEL, issue, item, current })
  console.log(`#${ISSUE} ${ACTION}${LABEL ? ` "${LABEL}"` : ''}: ${JSON.stringify(changes)}`)

  const edit = (fieldId, ...value) =>
    gh(
      'project',
      'item-edit',
      '--id',
      itemId,
      '--project-id',
      board.id,
      '--field-id',
      fieldId,
      ...value,
    )
  if (changes.status) {
    const option = board.status.options.find((entry) => entry.name === changes.status)
    if (!option) throw new Error(`The board has no "${changes.status}" status.`)
    edit(board.status.id, '--single-select-option-id', option.id)
  }
  if (changes.sprintId) edit(board.sprint.id, '--iteration-id', changes.sprintId)
}

/** Reads this one card's status and sprint; throws when it cannot, so a guess never moves a card. */
function cardState(itemId) {
  const query = `query($id:ID!){node(id:$id){... on ProjectV2Item{
    status:fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}
    sprint:fieldValueByName(name:"Sprint"){... on ProjectV2ItemFieldIterationValue{iterationId title startDate duration}}}}}`
  const { data } = json('api', 'graphql', '-f', `query=${query}`, '-F', `id=${itemId}`)
  const card = data?.node
  if (!card) throw new Error('Could not read the card, so it is left alone.')
  const { sprint } = card
  return {
    status: card.status?.name ?? 'Backlog',
    sprint: sprint && {
      id: sprint.iterationId,
      title: sprint.title,
      startDate: sprint.startDate,
      duration: sprint.duration,
    },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run()
