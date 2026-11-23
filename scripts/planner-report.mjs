/**
 * Report-only board run (#1425): reads every open issue and its card on the organization board,
 * works out the status each card should have (`planner-status.mjs`) and prints the cards that
 * differ or carry a flag. It moves nothing. Every call goes through `readOnlyRun`, which refuses
 * anything but a GraphQL query, so a write cannot be added by accident. It exits 0 when it read
 * every card and 1 when it could not. The workflow runs it as the planner app.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { isEpic, issueProblems, skipReason } from '../.github/scripts/issue-policy.mjs'
import { ORG as DEFAULT_ORG, POLICY_URL, PROJECT as DEFAULT_PROJECT } from './planner-config.mjs'
import { boardStatus, claimBranch } from './planner-status.mjs'

const PAGE_SIZE = 40

export const QUERY = `query($org:String!,$n:Int!,$cursor:String){organization(login:$org){projectV2(number:$n){
  items(first:${PAGE_SIZE},after:$cursor){pageInfo{hasNextPage endCursor}nodes{
    status:fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}
    content{__typename ... on Issue{number title body state repository{nameWithOwner}
      milestone{title} author{login __typename}
      labels(first:50){totalCount nodes{name}} assignees(first:10){totalCount nodes{login}}
      comments(last:100){totalCount nodes{body}}
      closedByPullRequestsReferences(first:50,includeClosedPrs:true){totalCount nodes{number state merged mergedAt}}
      timelineItems(first:100,itemTypes:[CROSS_REFERENCED_EVENT,REOPENED_EVENT]){totalCount nodes{__typename ... on ReopenedEvent{createdAt} ... on CrossReferencedEvent{source{__typename ... on PullRequest{number merged mergedAt body repository{nameWithOwner}}}}}}
      parent{number state} subIssues(first:100){totalCount nodes{number state}}}}}}}}}`

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

/** An issue has more entries in a list than one read returns, so its facts would be partial. */
export class TruncatedError extends Error {
  constructor(message, number) {
    super(message)
    this.number = number
  }
}

const nodesOf = (connection, list, number) => {
  const nodes = connection?.nodes ?? []
  if ((connection?.totalCount ?? nodes.length) > nodes.length) {
    throw new TruncatedError(
      `#${number}: its ${list} list is cut off, so it was not read in full.`,
      number,
    )
  }
  return nodes
}

/** Whether a pull request body has a closing keyword for this issue (GitHub's list of them). */
const closesIssue = (body, number) =>
  new RegExp(`\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s*:?\\s+#${number}(?!\\d)`, 'i').test(
    body ?? '',
  )

/**
 * Merged pull requests that declared they settle the issue: GitHub lists it in their closing
 * references, or (a stacked upper layer, which GitHub does not link) a pull request in this
 * repository carries a closing keyword for it. A plain mention never counts, and a merge the issue
 * was reopened after is left out, because a person chose that.
 */
function mergedThatSettle(issue, closing, events) {
  const reopenedAt = events
    .filter((event) => event.__typename === 'ReopenedEvent')
    .map((event) => Date.parse(event.createdAt))
  const stays = (mergedAt) => !reopenedAt.some((at) => at > Date.parse(mergedAt))
  const declared = events
    .map((event) => event.source)
    .filter(
      (pr) =>
        pr?.merged &&
        pr.repository?.nameWithOwner === issue.repository?.nameWithOwner &&
        closesIssue(pr.body, issue.number),
    )
  const byNumber = new Map(declared.map((pr) => [pr.number, pr]))
  for (const pr of closing) if (pr.merged) byNumber.set(pr.number, pr)
  return [...byNumber.values()].filter((pr) => stays(pr.mergedAt)).length
}

/** One board item as `{ number, title, current, facts }`, or null for what is not an open issue. */
export function cardFromNode(item, policy) {
  const issue = item?.content
  if (!issue) throw new Error('Could not read a card, so the report is incomplete.')
  if (issue.__typename !== 'Issue' || issue.state !== 'OPEN') return null
  const read = (list) => nodesOf(issue[list], list, issue.number)
  const labels = read('labels').map((entry) => entry.name)
  const forCheck = {
    title: issue.title,
    body: issue.body ?? '',
    state: 'open',
    labels,
    milestone: issue.milestone,
    user: { login: issue.author?.login, type: issue.author?.__typename },
  }
  const closing = read('closedByPullRequestsReferences')
  const events = read('timelineItems')
  const mergedPullRequests = mergedThatSettle(issue, closing, events)
  return {
    number: issue.number,
    title: issue.title,
    current: item.status?.name ?? 'No status',
    facts: {
      state: 'open',
      labels,
      assignees: read('assignees').map((entry) => entry.login),
      problems: skipReason(forCheck) ? [] : issueProblems(forCheck, policy),
      claimBranch: claimBranch(read('comments')),
      // Only what GitHub lists as closing the issue is In review; a plain mention never is
      openPullRequests: closing.filter((pr) => pr.state === 'OPEN' && !pr.merged).length,
      mergedPullRequests,
      closedPullRequests: closing.filter((pr) => pr.state === 'CLOSED' && !pr.merged).length,
      subIssues: read('subIssues').map(({ number, state }) => ({
        number,
        state: state.toLowerCase(),
      })),
      parent: issue.parent && {
        number: issue.parent.number,
        state: issue.parent.state.toLowerCase(),
      },
    },
  }
}

/**
 * The cards that differ from the rule or carry a flag. Epics are worked out after the other
 * issues, because they follow their children, and again for as many rounds as epics there are so
 * an epic under an epic is settled before its parent.
 */
export function buildReport(cards) {
  const statuses = new Map()
  const results = new Map()
  const work = (card) => {
    const children = card.facts.subIssues.map((child) => ({
      status: child.state === 'closed' ? 'Done' : (statuses.get(child.number) ?? 'Backlog'),
    }))
    const result = boardStatus({ ...card.facts, children })
    statuses.set(card.number, result.status)
    results.set(card.number, result)
  }
  const epics = cards.filter((card) => isEpic(card.facts))
  cards.filter((card) => !isEpic(card.facts)).forEach(work)
  for (let round = 0; round <= epics.length; round += 1) epics.forEach(work)
  return cards
    .map((card) => ({
      number: card.number,
      title: card.title,
      current: card.current,
      ...results.get(card.number),
    }))
    .filter((row) => row.current !== row.status || row.flags.length > 0)
}

const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\s+/g, ' ')

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
      card.facts.subIssues.some((child) => skipped.has(child.number)),
    )
    changed = parents.length > 0
    for (const card of parents) {
      skipped.add(card.number)
      unreadable.push(
        `#${card.number}: a child could not be read in full, so this card was left out.`,
      )
    }
    rest = rest.filter((card) => !skipped.has(card.number))
  }
  return rest
}

function readCards(run, { ORG, PROJECT }, policy) {
  const cards = []
  const unreadable = []
  const skipped = new Set()
  let cursor = null
  do {
    const args = [
      'api',
      'graphql',
      '-f',
      `query=${QUERY}`,
      '-F',
      `org=${ORG}`,
      '-F',
      `n=${PROJECT}`,
    ]
    if (cursor) args.push('-f', `cursor=${cursor}`)
    const { data } = JSON.parse(run(args))
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
        skipped.add(error.number)
      }
    }
    cursor = items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null
  } while (cursor)
  return { cards: withoutParentsOfSkipped(cards, skipped, unreadable), unreadable }
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
    run: (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
    env: { ORG, PROJECT },
    policy: JSON.parse(readFileSync(POLICY_URL, 'utf8')),
    log: (text) => console.log(text),
    appendSummary: (text) => {
      if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${text}\n`)
    },
  })
}
