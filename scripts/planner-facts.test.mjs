/**
 * Reading the facts the status rule needs from GitHub (#1425, #1435): one read shared by the report
 * and by the event moves. Test first.
 */
import { parse } from 'graphql'
import { describe, expect, it } from 'vitest'

import { STATUS_FIELD, TRUSTED_ASSOCIATIONS } from './planner-config.mjs'
import { BOARD_STATUS_MARKER } from './planner-comment.mjs'
import {
  factsFromIssue,
  isRepositoryWork,
  graphqlArgs,
  ISSUE_FIELDS,
  issueKey,
  readClaimBranches,
  TruncatedError,
  withRemoteBranch,
} from './planner-facts.mjs'
import { boardStatus } from './planner-status.mjs'

const policy = { types: ['bug', 'enhancement'], areas: ['ci'] }
const GOOD_BODY = `### Problem\n\nSomething long enough to count as a summary.\n\n### Acceptance criteria\n\n- [ ] it works\n\n### Files likely touched\n\na.mjs\n\n### Must not touch\n\nNone\n`

const issue = (over = {}) => ({
  number: 1,
  title: 'One',
  repository: { nameWithOwner: 'o/r' },
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
  ...over,
})
const crossRef = (source) => ({ __typename: 'CrossReferencedEvent', source })
const pull = (over = {}) => ({
  number: 9,
  state: 'OPEN',
  merged: false,
  authorAssociation: 'OWNER',
  body: 'See #1',
  repository: { nameWithOwner: 'o/r' },
  ...over,
})

describe('issueKey', () => {
  it('names an issue by repository and number', () => {
    expect(issueKey('o/r', 5)).toBe('o/r#5')
  })
})

describe('ISSUE_FIELDS', () => {
  it('parses as GraphQL inside an issue selection', () => {
    expect(() => parse(`query{node(id:"x"){... on Issue{${ISSUE_FIELDS}}}}`)).not.toThrow()
  })
})

describe('factsFromIssue', () => {
  it('names the issue by repository and number and keeps its state', () => {
    const card = factsFromIssue(issue({ state: 'CLOSED' }), policy)
    expect(card).toMatchObject({ key: 'o/r#1', repository: 'o/r', number: 1, title: 'One' })
    expect(card.facts.state).toBe('closed')
  })

  it('counts an open pull request that closes the issue as In review, also an upper stack layer', () => {
    const closing = {
      nodes: [
        {
          number: 5,
          state: 'OPEN',
          merged: false,
          authorAssociation: 'OWNER',
          repository: { nameWithOwner: 'o/r' },
        },
      ],
    }
    expect(
      factsFromIssue(issue({ closedByPullRequestsReferences: closing }), policy).facts
        .openPullRequests,
    ).toBe(1)
    // GitHub does not link a layer that targets another branch; its own description says it closes
    const upper = pull({ body: 'Closes #1' })
    const events = { nodes: [crossRef(upper)] }
    const card = factsFromIssue(issue({ timelineItems: events }), policy)
    expect(card.facts.openPullRequests).toBe(1)
    expect(boardStatus(card.facts).status).toBe('In review')
  })

  it('does not count a plain mention, a closed layer or a merged one as open', () => {
    const nodes = [
      crossRef(pull({ number: 2 })),
      crossRef(pull({ number: 3, body: 'Closes #1', state: 'CLOSED' })),
      crossRef(pull({ number: 4, body: 'Closes #1', state: 'MERGED', merged: true })),
    ]
    const card = factsFromIssue(issue({ timelineItems: { nodes } }), policy)
    expect(card.facts.openPullRequests).toBe(0)
    expect(card.facts.pullRequests).toBe(2)
  })

  it('lists each sub-issue by repository and number, with the projects it is on', () => {
    const sub = {
      number: 2,
      state: 'OPEN',
      repository: { nameWithOwner: 'o/r' },
      projectItems: { nodes: [{ project: { number: 1, owner: { login: 'o' } } }] },
    }
    const card = factsFromIssue(issue({ subIssues: { nodes: [sub] } }), policy)
    expect(card.facts.subIssues).toEqual([
      {
        key: 'o/r#2',
        repository: 'o/r',
        number: 2,
        state: 'open',
        projects: [{ owner: 'o', number: 1 }],
      },
    ])
  })

  it('starts with no remote branch, and refuses a list that is cut off', () => {
    expect(factsFromIssue(issue(), policy).facts.remoteBranch).toBeNull()
    expect(() => factsFromIssue(issue({ labels: { totalCount: 51, nodes: [] } }), policy)).toThrow(
      TruncatedError,
    )
  })
})

describe('withRemoteBranch', () => {
  it('sets the claim-named branch the remote holds for the card, and nothing else', () => {
    const card = factsFromIssue(issue(), policy)
    const branches = new Map([['o/r#1', 'agent/worker/1-x']])
    expect(withRemoteBranch(card, branches).facts.remoteBranch).toBe('agent/worker/1-x')
    expect(withRemoteBranch(card, new Map()).facts.remoteBranch).toBeNull()
    expect(card.facts.remoteBranch).toBeNull()
  })
})

describe('readClaimBranches', () => {
  const page = (names, next = null) =>
    JSON.stringify({
      data: {
        repository: {
          refs: {
            pageInfo: { hasNextPage: Boolean(next), endCursor: next },
            nodes: names.map((name) => ({ name })),
          },
        },
      },
    })

  it('reads every page and keeps the branches that follow the claim naming pattern', () => {
    const calls = []
    const pages = [
      page(['worker/12-a', 'dependabot-x'], 'c1'),
      page(['ops-lead/7-b', 'worker/x-1']),
    ]
    const run = (args) => {
      calls.push(args)
      return pages[calls.length - 1]
    }
    const branches = readClaimBranches(run, 'o/r')
    expect([...branches]).toEqual([
      ['o/r#12', 'agent/worker/12-a'],
      ['o/r#7', 'agent/ops-lead/7-b'],
    ])
    expect(calls[1].join(' ')).toContain('cursor=c1')
  })

  it('only ever sends a query', () => {
    const run = (args) => {
      expect(args.slice(0, 2)).toEqual(['api', 'graphql'])
      expect(args.join(' ')).not.toMatch(/mutation/i)
      return page([])
    }
    readClaimBranches(run, 'o/r')
  })
})

describe('graphqlArgs', () => {
  it('sends text variables raw and numbers typed, after the query', () => {
    expect(graphqlArgs('query{x}', { org: 'o' }, { n: 1 })).toEqual([
      'api',
      'graphql',
      '-f',
      'query=query{x}',
      '-f',
      'org=o',
      '-F',
      'n=1',
    ])
  })
})

describe('the Status field', () => {
  it('is named once', () => {
    expect(STATUS_FIELD).toBe('Status')
  })
})

describe('whose words count (a public repository)', () => {
  const comment = (body, authorAssociation) => ({
    databaseId: 1,
    body,
    authorAssociation,
    author: { login: 'x', __typename: 'User' },
  })
  const claim = '### [STEP] Claimed\n\nBranch: `agent/worker/1-x`'

  it('defines the people who count once: owner, member, collaborator', () => {
    expect([...TRUSTED_ASSOCIATIONS].sort()).toEqual(['COLLABORATOR', 'MEMBER', 'OWNER'])
  })

  it('takes a claim comment only from one of them', () => {
    const read = (association) =>
      factsFromIssue(issue({ comments: { nodes: [comment(claim, association)] } }), policy).facts
        .claimBranch
    for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      expect(read(association), association).toBe('agent/worker/1-x')
    }
    for (const association of ['NONE', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', undefined]) {
      expect(read(association), String(association)).toBeNull()
    }
  })

  it('counts a pull request GitHub links, or one that says it closes the issue, only from one of them', () => {
    const outsider = { authorAssociation: 'FIRST_TIME_CONTRIBUTOR' }
    const closing = {
      nodes: [
        {
          number: 5,
          state: 'OPEN',
          merged: false,
          repository: { nameWithOwner: 'o/r' },
          ...outsider,
        },
      ],
    }
    const declared = { nodes: [crossRef(pull({ number: 6, body: 'Closes #1', ...outsider }))] }
    const card = factsFromIssue(
      issue({ closedByPullRequestsReferences: closing, timelineItems: declared }),
      policy,
    )
    expect(card.facts).toMatchObject({ openPullRequests: 0, pullRequests: 0 })
    expect(boardStatus(card.facts).status).toBe('Backlog')
  })
})

describe('the planner comment on an issue', () => {
  const botComment = (body) => ({
    databaseId: 42,
    body,
    authorAssociation: 'NONE',
    author: { login: 'planner', __typename: 'Bot' },
  })

  it('is found for the app slug, with the status the planner last set', () => {
    const body = `${BOARD_STATUS_MARKER}\n<!-- planner:set=Ready -->\ntext`
    const card = factsFromIssue(
      issue({ comments: { nodes: [botComment(body)] } }),
      policy,
      'planner',
    )
    expect(card.facts.statusComment).toEqual({ id: 42, body })
    expect(card.facts.plannerSet).toBe('Ready')
  })

  it('is not found without the slug, or for another app', () => {
    const body = `${BOARD_STATUS_MARKER}\ntext`
    const read = (slug) =>
      factsFromIssue(issue({ comments: { nodes: [botComment(body)] } }), policy, slug).facts
    expect(read(undefined).statusComment).toBeNull()
    expect(read('someone-else').statusComment).toBeNull()
    expect(read(undefined).plannerSet).toBeNull()
  })
})

describe('isRepositoryWork: the one test of whose pull request counts', () => {
  const here = 'o/r'
  const pr = (over = {}) => ({
    authorAssociation: 'OWNER',
    repository: { nameWithOwner: 'o/r' },
    ...over,
  })

  it('accepts a pull request of this repository written by one of its people', () => {
    for (const authorAssociation of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      expect(isRepositoryWork(pr({ authorAssociation }), here)).toBe(true)
    }
  })

  it('refuses another repository, whoever wrote it: the association is relative to that repository', () => {
    expect(isRepositoryWork(pr({ repository: { nameWithOwner: 'attacker/x' } }), here)).toBe(false)
  })

  it('fails closed when the repository, the association or the pull request is missing', () => {
    expect(isRepositoryWork(pr({ repository: undefined }), here)).toBe(false)
    expect(isRepositoryWork(pr({ repository: {} }), here)).toBe(false)
    expect(isRepositoryWork(pr({ authorAssociation: undefined }), here)).toBe(false)
    expect(isRepositoryWork(pr({ authorAssociation: 'NONE' }), here)).toBe(false)
    expect(isRepositoryWork(undefined, here)).toBe(false)
    expect(isRepositoryWork(pr(), undefined)).toBe(false)
  })
})

describe('a pull request of another repository is neither started, In review nor merged', () => {
  const foreign = (state, merged = false) => ({
    nodes: [
      {
        number: 5,
        state,
        merged,
        mergedAt: '2026-11-01T00:00:00Z',
        authorAssociation: 'OWNER',
        repository: { nameWithOwner: 'attacker/x' },
      },
    ],
  })
  const from = (list, extra = {}) =>
    factsFromIssue(issue({ closedByPullRequestsReferences: list, ...extra }), policy).facts

  it.each([
    ['open', 'OPEN', false],
    ['closed', 'CLOSED', false],
    ['merged', 'MERGED', true],
  ])('gives nothing for a %s one linked by GitHub', (_name, state, merged) => {
    expect(from(foreign(state, merged))).toMatchObject({
      openPullRequests: 0,
      pullRequests: 0,
      mergedPullRequests: 0,
    })
  })

  it('gives neither In review nor In progress through the rule', () => {
    const open = from(foreign('OPEN'))
    expect(boardStatus({ ...open, assignees: ['a'] }).status).toBe('Backlog')
    expect(boardStatus({ ...open, assignees: ['a'] }).flags).toEqual([expect.any(String)])
  })

  it('also refuses a linked pull request with no repository', () => {
    const nodes = [{ number: 5, state: 'OPEN', merged: false, authorAssociation: 'OWNER' }]
    expect(from({ nodes }).openPullRequests).toBe(0)
  })
})
