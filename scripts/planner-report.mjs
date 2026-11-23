/**
 * Report-only board run (#1425): reads every open issue and its card on the organization board,
 * works out the status each card should have (`planner-status.mjs`) and prints the cards that
 * differ or carry a flag. It moves nothing. Every call goes through `readOnlyRun`, which refuses
 * anything but a GraphQL query, so a write cannot be added by accident. It exits 0 when it read
 * every card and 1 when it could not. The workflow runs it as the planner app.
 */
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { cell } from './content-types/render.mjs'
import {
  CARD_STATUS_FRAGMENT,
  ORG as DEFAULT_ORG,
  PROJECT as DEFAULT_PROJECT,
} from './planner-config.mjs'
import {
  factsFromIssue,
  graphqlArgs,
  ISSUE_FIELDS,
  readClaimBranches,
  readPolicy,
  runGh,
  TruncatedError,
  withRemoteBranch,
} from './planner-facts.mjs'
import { settleCards } from './planner-status.mjs'

const PAGE_SIZE = 40

export const QUERY = `query($org:String!,$n:Int!,$cursor:String){organization(login:$org){projectV2(number:$n){
  items(first:${PAGE_SIZE},after:$cursor){pageInfo{hasNextPage endCursor}nodes{
    ${CARD_STATUS_FRAGMENT}
    content{__typename ... on Issue{${ISSUE_FIELDS}}}}}}}}`

/** Wraps a command runner so that only a GraphQL query goes through; anything else throws. */
export function readOnlyRun(run) {
  return (args) => {
    const text = args.join(' ')
    const isQuery =
      args[0] === 'api' && args[1] === 'graphql' && !/mutation|--method|(^|\s)-X\b/i.test(text)
    if (!isQuery) throw new Error(`This run is read-only and refuses: ${args[0]} ${args[1] ?? ''}`)
    return run(args)
  }
}

/** One board item as `{ key, number, title, current, facts }`, or null for what is not an open issue. */
export function cardFromNode(item, policy) {
  const issue = item?.content
  if (!issue) throw new Error('Could not read a card, so the report is incomplete.')
  if (issue.__typename !== 'Issue' || issue.state !== 'OPEN') return null
  return { ...factsFromIssue(issue, policy), current: item.status?.name ?? 'No status' }
}

/**
 * The cards that differ from the rule or carry a flag, each with the status the rule gives. The
 * rule is `settleCards`, the same the event moves use.
 */
export function buildReport(cards) {
  const results = settleCards(cards)
  return cards
    .map((card) => ({
      number: card.number,
      title: card.title,
      current: card.current,
      ...results.get(card.key),
    }))
    .filter((row) => row.current !== row.status || row.flags.length > 0)
}

/** The markdown shown on screen and in the job summary. */
export function renderTable(rows, total, unreadable = []) {
  const head = `Board report (read only, nothing was changed): ${total} open cards read.`
  const missed = unreadable.length
    ? `\nNot read in full, so left out (the run exits 1): ${unreadable.map((text) => cell(text)).join(' ')}\n`
    : ''
  if (rows.length === 0) return `${head}\n\nEvery card read agrees with the rule.\n${missed}`
  const lines = rows.map(
    (row) =>
      `| #${row.number} ${cell(row.title)} | ${row.current} | ${row.status} | ${cell(row.reason)} | ${cell(row.flags.join(' '))} |`,
  )
  return (
    [
      `${head} ${rows.length} differ or carry a flag.`,
      '',
      '| Issue | Card says | Rule says | Reason | Flags |',
      '| --- | --- | --- | --- | --- |',
      ...lines,
      '',
    ].join('\n') + missed
  )
}

/** A parent of a card that was skipped is not read in full either: its status follows that child. */
function withoutParentsOfSkipped(cards, skipped, unreadable) {
  let rest = cards
  for (let changed = true; changed; ) {
    const parents = rest.filter((card) =>
      card.facts.subIssues.some((child) => skipped.has(child.key)),
    )
    changed = parents.length > 0
    for (const card of parents) {
      skipped.add(card.key)
      unreadable.push(
        `#${card.number}: a child could not be read in full, so this card was left out.`,
      )
    }
    rest = rest.filter((card) => !skipped.has(card.key))
  }
  return rest
}

function readCards(run, { ORG, PROJECT }, policy) {
  const cards = []
  const unreadable = []
  const skipped = new Set()
  let cursor = null
  do {
    const strings = { org: ORG, ...(cursor && { cursor }) }
    const { data } = JSON.parse(run(graphqlArgs(QUERY, strings, { n: PROJECT })))
    const items = data?.organization?.projectV2?.items
    if (!items) throw new Error('Could not read the board.')
    for (const item of items.nodes) {
      try {
        const card = cardFromNode(item, policy)
        if (card) cards.push(card)
      } catch (error) {
        // One cut-off card is listed and skipped; any other failure stops the run
        if (!(error instanceof TruncatedError)) throw error
        unreadable.push(error.message)
        skipped.add(error.key)
      }
    }
    cursor = items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null
  } while (cursor)
  const branches = new Map()
  for (const repository of new Set(cards.map((card) => card.repository))) {
    readClaimBranches(run, repository).forEach((branch, key) => branches.set(key, branch))
  }
  const read = cards.map((card) => withRemoteBranch(card, branches))
  return { cards: withoutParentsOfSkipped(read, skipped, unreadable), unreadable }
}

/** Runs the report; returns the exit code. The writers are passed in so a test can watch them. */
export function main({ run, env, policy, log, appendSummary }) {
  try {
    const { cards, unreadable } = readCards(readOnlyRun(run), env, policy)
    const table = renderTable(buildReport(cards), cards.length, unreadable)
    log(table)
    appendSummary(table)
    return unreadable.length > 0 ? 1 : 0
  } catch (error) {
    log(`::error::The board report could not read everything: ${error.message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ORG = DEFAULT_ORG, PROJECT = DEFAULT_PROJECT, GITHUB_STEP_SUMMARY } = process.env
  process.exitCode = main({
    run: runGh,
    env: { ORG, PROJECT },
    policy: readPolicy(),
    log: (text) => console.log(text),
    appendSummary: (text) => {
      if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${text}\n`)
    },
  })
}
