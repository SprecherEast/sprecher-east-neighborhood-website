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

import { issueProblems, skipReason } from '../.github/scripts/issue-policy.mjs'
import { boardStatus, claimBranch } from './planner-status.mjs'

const POLICY = new URL('../.github/label-policy.json', import.meta.url)
const PAGE_SIZE = 40

const QUERY = `query($org:String!,$n:Int!,$cursor:String){organization(login:$org){projectV2(number:$n){
  items(first:${PAGE_SIZE},after:$cursor){pageInfo{hasNextPage endCursor}nodes{
    status:fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}
    content{__typename ... on Issue{number title body state
      milestone{title} author{login __typename}
      labels(first:50){nodes{name}} assignees(first:10){nodes{login}}
      comments(last:30){nodes{body}}
      closedByPullRequestsReferences(first:20,includeClosedPrs:true){nodes{state merged}}
      timelineItems(first:50,itemTypes:[CROSS_REFERENCED_EVENT]){nodes{... on CrossReferencedEvent{source{... on PullRequest{merged}}}}}
      parent{number state} subIssues(first:100){nodes{number state}}}}}}}}`

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

const names = (connection) => (connection?.nodes ?? []).map((entry) => entry.name ?? entry.login)

/** One board item as `{ number, title, current, facts }`, or null for what is not an open issue. */
export function cardFromNode(item, policy) {
  const issue = item?.content
  if (!issue) throw new Error('Could not read a card, so the report is incomplete.')
  if (issue.__typename !== 'Issue' || issue.state !== 'OPEN') return null
  const labels = names(issue.labels)
  const forCheck = {
    title: issue.title,
    body: issue.body ?? '',
    state: 'open',
    labels,
    milestone: issue.milestone,
    user: { login: issue.author?.login, type: issue.author?.__typename },
  }
  const closing = issue.closedByPullRequestsReferences?.nodes ?? []
  const referenced = (issue.timelineItems?.nodes ?? []).filter((event) => event.source?.merged)
  return {
    number: issue.number,
    title: issue.title,
    current: item.status?.name ?? 'No status',
    facts: {
      state: 'open',
      labels,
      assignees: names(issue.assignees),
      problems: skipReason(forCheck) ? [] : issueProblems(forCheck, policy),
      claimBranch: claimBranch(issue.comments?.nodes ?? []),
      openPullRequests: closing.filter((pr) => pr.state === 'OPEN').length,
      mergedPullRequests: closing.filter((pr) => pr.merged).length + referenced.length,
      subIssues: (issue.subIssues?.nodes ?? []).map(({ number, state }) => ({
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
 * issues, because they follow their children.
 */
export function buildReport(cards) {
  const statuses = new Map()
  const results = new Map()
  const ordered = [...cards].sort(
    (a, b) => Number(a.facts.labels.includes('epic')) - Number(b.facts.labels.includes('epic')),
  )
  for (const card of ordered) {
    const children = card.facts.subIssues.map((child) => ({
      status: child.state === 'closed' ? 'Done' : (statuses.get(child.number) ?? 'Backlog'),
    }))
    const result = boardStatus({ ...card.facts, children })
    statuses.set(card.number, result.status)
    results.set(card.number, result)
  }
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
export function renderTable(rows, total) {
  const head = `Board report (read only, nothing was changed): ${total} open cards read.`
  if (rows.length === 0) return `${head}\n\nEvery card agrees with the rule.\n`
  const lines = rows.map(
    (row) =>
      `| #${row.number} ${cell(row.title)} | ${row.current} | ${row.status} | ${cell(row.reason)} | ${cell(row.flags.join(' '))} |`,
  )
  return [
    `${head} ${rows.length} differ or carry a flag.`,
    '',
    '| Issue | Card says | Rule says | Reason | Flags |',
    '| --- | --- | --- | --- | --- |',
    ...lines,
    '',
  ].join('\n')
}

function readCards(run, { ORG, PROJECT }, policy) {
  const cards = []
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
      const card = cardFromNode(item, policy)
      if (card) cards.push(card)
    }
    cursor = items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null
  } while (cursor)
  return cards
}

/** Runs the report; returns the exit code. The writers are passed in so a test can watch them. */
export function main({ run, env, policy, log, appendSummary }) {
  try {
    const cards = readCards(readOnlyRun(run), env, policy)
    const table = renderTable(buildReport(cards), cards.length)
    log(table)
    appendSummary(table)
    return 0
  } catch (error) {
    log(`::error::The board report could not read everything: ${error.message}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ORG = 'SprecherEast', PROJECT = '1', GITHUB_STEP_SUMMARY } = process.env
  process.exitCode = main({
    run: (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
    env: { ORG, PROJECT },
    policy: JSON.parse(readFileSync(POLICY, 'utf8')),
    log: (text) => console.log(text),
    appendSummary: (text) => {
      if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${text}\n`)
    },
  })
}
