/**
 * Keeps the board in step with the work, as the planner app (#941). When an issue is opened or
 * reopened its card goes into the sprint that is running; when it is assigned, which is how work is
 * claimed, the card also becomes In progress. GitHub's own board rules already set In review and
 * Done. Finished work keeps its sprint (`planner-rules.mjs`), and a card never moves backwards.
 * The decision is pure and tested; the command line below reads and writes the board with `gh`,
 * signed in as the app by the workflow.
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import { canChangeSprint } from './planner-rules.mjs'

const DAY_MS = 86_400_000
const SPRINT_ACTIONS = new Set(['opened', 'reopened', 'assigned'])
const NO_BACKWARDS = new Set(['In review', 'Done'])

/** The sprint whose days contain `today` (a yyyy-mm-dd date), if one is running. */
export function findCurrentSprint(iterations, today) {
  const day = Date.parse(today)
  return iterations.find((sprint) => {
    const start = Date.parse(sprint.startDate)
    return day >= start && day < start + sprint.duration * DAY_MS
  })
}

/** What to change on a card: `{ status?, sprintId? }`, empty when it is already right. */
export function decideChanges({ action, item, current }) {
  if (!SPRINT_ACTIONS.has(action)) return {}
  const changes = {}
  if (action === 'assigned' && !NO_BACKWARDS.has(item.status) && item.status !== 'In progress') {
    changes.status = 'In progress'
  }
  const inCurrent = item.sprint?.id === current?.id
  if (current && !inCurrent && canChangeSprint(item).allowed) changes.sprintId = current.id
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

function run() {
  const { REPO, ISSUE, ACTION, ORG = 'SprecherEast', PROJECT = '1' } = process.env
  if (!/^\d+$/.test(ISSUE ?? '')) throw new Error('ISSUE must be an issue number.')
  const url = `https://github.com/${REPO}/issues/${ISSUE}`
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
  const changes = decideChanges({ action: ACTION, item, current })
  console.log(`#${ISSUE} ${ACTION}: ${JSON.stringify(changes)}`)

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
