/**
 * The report-only board run (#1425): it reads every open issue and its card, compares each card
 * with the rule in `planner-status.mjs` and prints the differences. Test first, and one test
 * proves it issues no write of any kind.
 */
import { describe, expect, it } from 'vitest'

import { buildReport, cardFromNode, main, readOnlyRun, renderTable } from './planner-report.mjs'

const policy = {
  types: ['bug', 'enhancement'],
  areas: ['ci'],
}
const GOOD_BODY = `### Problem\n\nSomething long enough to count as a summary.\n\n### Acceptance criteria\n\n- [ ] it works\n\n### Files likely touched\n\na.mjs\n\n### Must not touch\n\nNone\n`

const node = (over = {}, content = {}) => ({
  __typename: 'ProjectV2Item',
  status: { name: 'Backlog' },
  content: {
    __typename: 'Issue',
    number: 1,
    title: 'One',
    body: GOOD_BODY,
    state: 'OPEN',
    milestone: { title: 'Backlog' },
    author: { login: 'someone', __typename: 'User' },
    labels: { nodes: [{ name: 'enhancement' }, { name: 'ci' }, { name: 'priority: low' }] },
    assignees: { nodes: [] },
    comments: { nodes: [] },
    closedByPullRequestsReferences: { nodes: [] },
    timelineItems: { nodes: [] },
    parent: null,
    subIssues: { nodes: [] },
    ...content,
  },
  ...over,
})

const labels = (...names) => ({ nodes: names.map((name) => ({ name })) })

describe('cardFromNode', () => {
  it('builds the facts from a card, and skips closed issues, pull requests and drafts', () => {
    const card = cardFromNode(
      node(
        {},
        {
          assignees: { nodes: [{ login: 'a' }] },
          comments: { nodes: [{ body: '### [STEP] Claimed\n\nBranch: `agent/x`' }] },
          closedByPullRequestsReferences: { nodes: [{ state: 'OPEN', merged: false }] },
          timelineItems: { nodes: [{ source: { merged: true } }, { source: {} }] },
        },
      ),
      policy,
    )
    expect(card.current).toBe('Backlog')
    expect(card.facts).toMatchObject({
      state: 'open',
      assignees: ['a'],
      claimBranch: 'agent/x',
      openPullRequests: 1,
      mergedPullRequests: 1,
      problems: [],
    })
    expect(cardFromNode(node({}, { state: 'CLOSED' }), policy)).toBeNull()
    expect(cardFromNode({ content: { __typename: 'PullRequest' } }, policy)).toBeNull()
    expect(cardFromNode({ content: { __typename: 'DraftIssue' } }, policy)).toBeNull()
  })

  it('runs the issue check on the issue, so a failing one is not Ready', () => {
    const card = cardFromNode(node({}, { body: 'no sections', labels: labels('ready') }), policy)
    expect(card.facts.problems.length).toBeGreaterThan(0)
  })

  it('throws when the card cannot be read', () => {
    expect(() => cardFromNode({ content: null }, policy)).toThrow(/read/i)
  })
})

describe('buildReport', () => {
  const card = (number, current, facts = {}) => ({
    number,
    title: `Issue ${number}`,
    current,
    facts: {
      state: 'open',
      labels: [],
      assignees: [],
      problems: [],
      claimBranch: null,
      openPullRequests: 0,
      mergedPullRequests: 0,
      subIssues: [],
      parent: null,
      ...facts,
    },
  })

  it('lists only the cards that differ from the rule or carry a flag', () => {
    const rows = buildReport([
      card(1, 'Backlog'),
      card(2, 'In progress'),
      card(3, 'Backlog', { assignees: ['a'] }),
    ])
    expect(rows.map((row) => row.number)).toEqual([2, 3])
    expect(rows[0]).toMatchObject({ current: 'In progress', status: 'Backlog' })
    expect(rows[1].flags).toHaveLength(1)
  })

  it('gives an epic its status from its children', () => {
    const rows = buildReport([
      card(10, 'Backlog', {
        labels: ['epic'],
        assignees: ['a'],
        subIssues: [{ number: 11, state: 'open' }],
      }),
      card(11, 'In progress', { assignees: ['a'], claimBranch: 'x/y' }),
    ])
    expect(rows).toEqual([expect.objectContaining({ number: 10, status: 'In progress' })])
  })

  it('treats closed children as Done and flags an epic whose children are all closed', () => {
    const [row] = buildReport([
      card(10, 'Backlog', { labels: ['epic'], subIssues: [{ number: 11, state: 'closed' }] }),
    ])
    expect(row.flags.join(' ')).toMatch(/every child/i)
  })
})

describe('renderTable', () => {
  it('prints one row per card, with the current status, the rule status, reason and flags', () => {
    const text = renderTable(
      [
        {
          number: 2,
          title: 'A | B',
          current: 'In progress',
          status: 'Backlog',
          reason: 'why',
          flags: ['f1'],
        },
      ],
      5,
    )
    expect(text).toContain('| #2 A')
    expect(text).toContain('In progress')
    expect(text).toContain('Backlog')
    expect(text).toContain('f1')
    expect(text).toContain('A \\| B')
    expect(text).toMatch(/5 open cards/)
  })

  it('says so when every card agrees', () => {
    expect(renderTable([], 3)).toMatch(/agree/i)
  })
})

describe('main: reads everything, writes nothing', () => {
  const page = (nodes, next = null) => ({
    data: {
      organization: {
        projectV2: { items: { pageInfo: { hasNextPage: Boolean(next), endCursor: next }, nodes } },
      },
    },
  })
  const run = (calls, pages) => (args) => {
    calls.push(args)
    return JSON.stringify(pages.shift())
  }
  const env = { ORG: 'Org', PROJECT: '1' }

  it('reads every page, reports the difference and exits 0', async () => {
    const calls = []
    const out = []
    const code = main({
      run: run(calls, [
        page([node({ status: { name: 'In progress' } })], 'c1'),
        page([node({}, { number: 2 })]),
      ]),
      env,
      policy,
      log: (text) => out.push(text),
      appendSummary: (text) => out.push(`SUMMARY:${text}`),
    })
    expect(code).toBe(0)
    expect(calls).toHaveLength(2)
    expect(out.join('\n')).toContain('#1')
    expect(out.some((line) => line.startsWith('SUMMARY:'))).toBe(true)
  })

  it('issues no write of any kind: only read queries go out', () => {
    const calls = []
    main({
      run: run(calls, [page([node({ status: { name: 'Ready' } })])]),
      env,
      policy,
      log: () => {},
      appendSummary: () => {},
    })
    expect(calls.length).toBeGreaterThan(0)
    for (const args of calls) {
      expect(args.slice(0, 2)).toEqual(['api', 'graphql'])
      expect(args.join(' ')).not.toMatch(/mutation|--method|-X\b|item-edit|item-add/i)
    }
  })

  it('exits non-zero when it cannot read everything', () => {
    const throwing = () => {
      throw new Error('boom')
    }
    const code = main({ run: throwing, env, policy, log: () => {}, appendSummary: () => {} })
    expect(code).toBe(1)
    const unreadable = main({
      run: run([], [page([{ content: null }])]),
      env,
      policy,
      log: () => {},
      appendSummary: () => {},
    })
    expect(unreadable).toBe(1)
  })

  it('does not write the summary when it could not read everything', () => {
    const written = []
    main({
      run: () => {
        throw new Error('boom')
      },
      env,
      policy,
      log: () => {},
      appendSummary: (text) => written.push(text),
    })
    expect(written).toEqual([])
  })
})

describe('readOnlyRun', () => {
  const inner = () => '{}'

  it('lets a GraphQL query through', () => {
    expect(readOnlyRun(inner)(['api', 'graphql', '-f', 'query=query{viewer{login}}'])).toBe('{}')
  })

  it('refuses a mutation, another command or a non-GET method', () => {
    const guard = readOnlyRun(inner)
    expect(() => guard(['api', 'graphql', '-f', 'query=mutation{x}'])).toThrow(/read-only/i)
    expect(() => guard(['project', 'item-edit', '--id', 'x'])).toThrow(/read-only/i)
    expect(() => guard(['api', 'graphql', '--method', 'POST'])).toThrow(/read-only/i)
    expect(() => guard(['api', 'repos/o/r/issues/1', '-X', 'PATCH'])).toThrow(/read-only/i)
  })
})
