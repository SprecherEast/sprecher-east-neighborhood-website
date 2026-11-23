/**
 * What the planner app does to a card when an event concerns its issue (#941, #1089, #1435): it
 * gathers that issue's facts, sets the card to what the one status rule says, and writes the reason
 * on the issue. No other card, label or assignee changes. Test first.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import * as board from './planner-board.mjs'
import {
  BOARD_STATUS_MARKER,
  boardStatusComment,
  decideChanges,
  findStatusComment,
  moveCard,
  needsComment,
} from './planner-board.mjs'
import { CARD_STATUS_FRAGMENT, ORG, PROJECT, STATUS } from './planner-config.mjs'
import { OWNER_LABEL, READY_LABEL, readyBlockers } from './planner-ready.mjs'
import { QUERY } from './planner-report.mjs'

const read = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
const source = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')

describe('the planner app and sprints', () => {
  it('has no sprint logic', () => {
    expect(Object.keys(board).filter((name) => /sprint/i.test(name))).toEqual([])
    expect(source('./planner-board.mjs')).not.toMatch(/sprint|iteration/i)
  })
})

describe('the status logic of the event moves', () => {
  it('is the rule alone: the old per-event decisions are gone', () => {
    const text = source('./planner-board.mjs')
    for (const old of ['NO_BACKWARDS', 'isClaim', 'statusFor', 'readyRemoved', 'readyWasRemoved']) {
      expect(text, old).not.toContain(old)
    }
    expect(text, 'a status name written out').not.toMatch(
      /'(Backlog|Ready|In progress|In review|Done)'/,
    )
  })

  it('defines the ready label and its blockers in the rules module, not in the script', () => {
    expect(board.READY_LABEL).toBeUndefined()
    expect(board.readyBlockers).toBeUndefined()
    expect(source('./planner-ready.mjs')).not.toMatch(/planner-(board|status|report|facts)/)
  })

  it('reads a card status with the one fragment the report also uses', () => {
    expect(QUERY).toContain(CARD_STATUS_FRAGMENT)
    expect(source('./planner-board.mjs')).toContain('CARD_STATUS_FRAGMENT')
    expect(source('./planner-board.mjs')).not.toContain('fieldValueByName')
    expect(source('./planner-report.mjs')).not.toContain('fieldValueByName')
  })
})

describe('the names the app and the agents rely on', () => {
  it('uses only marker labels the label policy defines', () => {
    const { markers } = read('../.github/label-policy.json')
    for (const label of [READY_LABEL, OWNER_LABEL]) expect(markers[label]).toBeTruthy()
  })

  it('lists each native issue field with a numeric ID and its option names', () => {
    const { $comment, ...fields } = read('../.github/issue-fields.json')
    expect($comment).toBeTruthy()
    expect(Object.keys(fields)).toEqual(['Priority', 'Effort'])
    for (const field of Object.values(fields)) {
      expect(Number.isInteger(field.id)).toBe(true)
      expect(field.options.length).toBeGreaterThan(0)
    }
  })

  it('lists what keeps an issue out of Ready: the owner label, then the failed rules', () => {
    expect(readyBlockers({ labels: ['needs owner'], problems: ['ISSUE-TYPE'] })).toEqual([
      'needs owner',
      'ISSUE-TYPE',
    ])
  })
})

describe('decideChanges', () => {
  const result = (status) => ({ status, reason: 'why', flags: [] })

  it('sets the card to the status the rule gives', () => {
    expect(
      decideChanges({ result: result(STATUS.inProgress), item: { status: STATUS.ready } }),
    ).toEqual({
      status: STATUS.inProgress,
    })
  })

  it('changes nothing when the card already says it', () => {
    expect(decideChanges({ result: result(STATUS.ready), item: { status: STATUS.ready } })).toEqual(
      {},
    )
  })

  it('sets and reads no field other than the status', () => {
    const changes = decideChanges({ result: result(STATUS.done), item: { status: STATUS.backlog } })
    expect(Object.keys(changes)).toEqual(['status'])
  })
})

describe('the Board status comment', () => {
  const result = { status: STATUS.inProgress, reason: 'It is assigned.', flags: ['A flag.'] }

  it('carries a hidden marker, the new status, the old one, the reason and the flags', () => {
    const body = boardStatusComment({ from: STATUS.ready, result })
    expect(body.startsWith(BOARD_STATUS_MARKER)).toBe(true)
    expect(body).toContain('Board status: In progress')
    expect(body).toContain('Ready')
    expect(body).toContain('It is assigned.')
    expect(body).toContain('A flag.')
  })

  it('is written only for statuses GitHub does not set itself', () => {
    expect([STATUS.backlog, STATUS.ready, STATUS.inProgress].map(needsComment)).toEqual([
      true,
      true,
      true,
    ])
    expect([STATUS.inReview, STATUS.done].map(needsComment)).toEqual([false, false])
  })

  it('is found again by its marker, and only when a bot wrote it', () => {
    const mine = { id: 7, type: 'Bot', body: `${BOARD_STATUS_MARKER}\nold` }
    const forged = { id: 3, type: 'User', body: `${BOARD_STATUS_MARKER}\nfake` }
    const other = { id: 4, type: 'Bot', body: 'something else' }
    expect(findStatusComment([forged, other, mine])).toEqual(mine)
    expect(findStatusComment([forged, other])).toBeNull()
  })
})

/** A small GitHub: the issues it holds, the cards on the board, and a record of every write. */
function world({ issues, cards = {}, branches = [], comments = {} }) {
  const writes = []
  const reads = []
  const options = Object.values(STATUS).map((name, index) => ({ id: `opt${index}`, name }))
  const run = (args) => {
    const text = args.join(' ')
    const query = args.find((arg) => arg.startsWith('query=')) ?? ''
    if (args[0] === 'project' && args[1] === 'item-add') {
      const number = Number(args[args.indexOf('--url') + 1].split('/').pop())
      reads.push(`item-add ${number}`)
      return JSON.stringify({ id: `item${number}` })
    }
    if (args[0] === 'project' && args[1] === 'item-edit') {
      writes.push({ kind: 'edit', item: args[args.indexOf('--id') + 1], option: args.at(-1) })
      return ''
    }
    if (query.includes('projectV2(number')) {
      return JSON.stringify({
        data: { organization: { projectV2: { id: 'P1', status: { id: 'F1', options } } } },
      })
    }
    if (query.includes('node(id')) {
      const number = Number(text.match(/id=item(\d+)/)[1])
      const status = cards[number]
      return JSON.stringify({ data: { node: { status: status ? { name: status } : null } } })
    }
    if (query.includes('refs(')) {
      const nodes = branches.map((name) => ({ name: name.replace('agent/', '') }))
      return JSON.stringify({
        data: { repository: { refs: { pageInfo: { hasNextPage: false }, nodes } } },
      })
    }
    if (query.includes('issue(number')) {
      const number = Number(text.match(/number=(\d+)/)[1])
      reads.push(`issue ${number}`)
      return JSON.stringify({ data: { repository: { issue: issues[number] ?? null } } })
    }
    if (args[0] === 'api' && args.at(-2) === '--jq') {
      const number = Number(args.find((arg) => arg.includes('/issues/')).split('/')[4])
      return (comments[number] ?? []).map((entry) => JSON.stringify(entry)).join('\n')
    }
    if (args[0] === 'api' && args.includes('-X')) {
      writes.push({
        kind: args[args.indexOf('-X') + 1],
        path: args.find((arg) => arg.startsWith('repos/')),
        body: args.at(-1),
      })
      return '{}'
    }
    throw new Error(`unexpected call: ${text}`)
  }
  return { run, writes, reads }
}

const GOOD_BODY = `### Problem\n\nSomething long enough to count as a summary.\n\n### Acceptance criteria\n\n- [ ] it works\n\n### Files likely touched\n\na.mjs\n\n### Must not touch\n\nNone\n`
const policy = { types: ['bug', 'enhancement'], areas: ['ci'] }
const node = (number, over = {}) => ({
  number,
  title: `Issue ${number}`,
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
const claim = (branch = 'agent/worker/5-x') => ({
  nodes: [{ body: `### [STEP] Claimed\n\n**Branch:** \`${branch}\`.` }],
})
const owner = { nodes: [{ login: 'someone' }] }
const env = (number, action = 'assigned') => ({
  REPO: 'o/r',
  ISSUE: String(number),
  ACTION: action,
  ORG,
  PROJECT,
})
const go = (w, number, action) =>
  moveCard({ run: w.run, env: env(number, action), policy, log: () => {} })
const editsOf = (w) => w.writes.filter((entry) => entry.kind === 'edit')
const optionFor = (status) => `opt${Object.values(STATUS).indexOf(status)}`

describe('an event moves the card by the rule', () => {
  it('sets the card to the rule status and writes the reason on the issue', () => {
    const w = world({
      issues: { 5: node(5, { assignees: owner, comments: claim() }) },
      cards: { 5: STATUS.ready },
    })
    go(w, 5, 'assigned')
    expect(editsOf(w)).toEqual([
      { kind: 'edit', item: 'item5', option: optionFor(STATUS.inProgress) },
    ])
    const posts = w.writes.filter((entry) => entry.kind === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0].path).toBe('repos/o/r/issues/5/comments')
    expect(posts[0].body).toContain(BOARD_STATUS_MARKER)
    expect(posts[0].body).toContain('agent/worker/5-x')
  })

  it.each([
    'opened',
    'reopened',
    'assigned',
    'labeled',
    'unlabeled',
    'edited',
    'milestoned',
    'demilestoned',
    'sync',
  ])('leaves a claimed issue In progress after a %s event, however quiet it is', (action) => {
    const w = world({
      issues: { 5: node(5, { assignees: owner, comments: claim() }) },
      cards: { 5: STATUS.inProgress },
    })
    go(w, 5, action)
    expect(w.writes).toEqual([])
  })

  it('catches up a card the rule says is Ready, and one that lost its label', () => {
    const ready = {
      nodes: [
        { name: 'enhancement' },
        { name: 'ci' },
        { name: 'priority: low' },
        { name: 'ready' },
      ],
    }
    const w = world({ issues: { 5: node(5, { labels: ready }) }, cards: { 5: STATUS.backlog } })
    go(w, 5, 'labeled')
    expect(editsOf(w)[0].option).toBe(optionFor(STATUS.ready))
    const w2 = world({ issues: { 5: node(5) }, cards: { 5: STATUS.ready } })
    go(w2, 5, 'unlabeled')
    expect(editsOf(w2)[0].option).toBe(optionFor(STATUS.backlog))
  })

  it('treats a pull request that closes the issue, and a remote branch, as work started', () => {
    const closed = {
      nodes: [
        {
          number: 8,
          state: 'MERGED',
          merged: true,
          mergedAt: '2026-01-01T00:00:00Z',
          repository: { nameWithOwner: 'o/r' },
        },
      ],
    }
    const byPull = world({
      issues: { 5: node(5, { assignees: owner, closedByPullRequestsReferences: closed }) },
      cards: { 5: STATUS.backlog },
    })
    go(byPull, 5, 'sync')
    expect(editsOf(byPull)[0].option).toBe(optionFor(STATUS.inProgress))
    const byBranch = world({
      issues: { 5: node(5, { assignees: owner }) },
      cards: { 5: STATUS.backlog },
      branches: ['agent/worker/5-x'],
    })
    go(byBranch, 5, 'sync')
    expect(editsOf(byBranch)[0].option).toBe(optionFor(STATUS.inProgress))
  })

  it('does not count assignment alone as a start', () => {
    const w = world({ issues: { 5: node(5, { assignees: owner }) }, cards: { 5: STATUS.backlog } })
    go(w, 5, 'assigned')
    expect(w.writes).toEqual([])
  })

  it('moves only the card of the issue the event concerns, children are only read', () => {
    const epic = node(5, {
      labels: { nodes: [{ name: 'epic' }] },
      subIssues: {
        nodes: [
          {
            number: 6,
            state: 'OPEN',
            repository: { nameWithOwner: 'o/r' },
            projectItems: {
              nodes: [{ project: { number: Number(PROJECT), owner: { login: ORG } } }],
            },
          },
          {
            number: 7,
            state: 'OPEN',
            repository: { nameWithOwner: 'o/r' },
            projectItems: { nodes: [] },
          },
        ],
      },
    })
    const w = world({
      issues: {
        5: epic,
        6: node(6, { assignees: owner, comments: claim('agent/worker/6-y') }),
        7: node(7),
      },
      cards: { 5: STATUS.backlog, 6: STATUS.ready, 7: STATUS.ready },
    })
    go(w, 5, 'edited')
    expect(editsOf(w)).toEqual([
      { kind: 'edit', item: 'item5', option: optionFor(STATUS.inProgress) },
    ])
    expect(
      w.writes.every(
        (entry) => entry.kind === 'edit' || entry.path === 'repos/o/r/issues/5/comments',
      ),
    ).toBe(true)
    expect(w.reads).toContain('issue 6')
    expect(w.reads, 'a sub-issue that is not on the board is not read').not.toContain('issue 7')
  })

  it('moves nothing and writes nothing when the issue could not be read in full', () => {
    const w = world({
      issues: { 5: node(5, { comments: { totalCount: 101, nodes: [] } }) },
      cards: { 5: STATUS.ready },
    })
    expect(() => go(w, 5, 'edited')).toThrow(/cut off/)
    expect(w.writes).toEqual([])
  })

  it('leaves a closed issue alone on an event that is not about the card', () => {
    const w = world({ issues: { 5: node(5, { state: 'CLOSED' }) }, cards: {} })
    go(w, 5, 'edited')
    expect(w.reads.filter((entry) => entry.startsWith('item-add'))).toEqual([])
    expect(w.writes).toEqual([])
  })

  it('refuses an issue that is not a number', () => {
    expect(() => moveCard({ run: () => '', env: { ...env(5), ISSUE: '5; rm' }, policy })).toThrow(
      /number/,
    )
  })
})

describe('the reason on the issue', () => {
  const claimed = { 5: node(5, { assignees: owner, comments: claim() }) }

  it('edits the one Board status comment in place on a later move', () => {
    const old = { id: 77, type: 'Bot', body: `${BOARD_STATUS_MARKER}\nold text` }
    const w = world({ issues: claimed, cards: { 5: STATUS.ready }, comments: { 5: [old] } })
    go(w, 5, 'assigned')
    const writes = w.writes.filter((entry) => entry.kind !== 'edit')
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({ kind: 'PATCH', path: 'repos/o/r/issues/comments/77' })
  })

  it('does not take over a look-alike comment written by a person', () => {
    const forged = { id: 78, type: 'User', body: `${BOARD_STATUS_MARKER}\nfake` }
    const w = world({ issues: claimed, cards: { 5: STATUS.ready }, comments: { 5: [forged] } })
    go(w, 5, 'assigned')
    expect(w.writes.filter((entry) => entry.kind === 'POST')).toHaveLength(1)
  })

  it('writes none when GitHub sets the status itself, In review and Done', () => {
    const closing = {
      nodes: [{ number: 8, state: 'OPEN', merged: false, repository: { nameWithOwner: 'o/r' } }],
    }
    const review = world({
      issues: { 5: node(5, { closedByPullRequestsReferences: closing }) },
      cards: { 5: STATUS.inProgress },
    })
    go(review, 5, 'sync')
    expect(editsOf(review)[0].option).toBe(optionFor(STATUS.inReview))
    expect(review.writes.filter((entry) => entry.kind !== 'edit')).toEqual([])
    const done = world({
      issues: { 5: node(5, { state: 'CLOSED' }) },
      cards: { 5: STATUS.inProgress },
    })
    go(done, 5, 'sync')
    expect(editsOf(done)[0].option).toBe(optionFor(STATUS.done))
    expect(done.writes.filter((entry) => entry.kind !== 'edit')).toEqual([])
  })

  it('never quotes what a person wrote on the issue, only the fixed reason and the branch name', () => {
    const talk = { body: 'The owner says: ship the SECRET-PLAN soon' }
    const withTalk = { nodes: [talk, ...claim().nodes] }
    const w = world({
      issues: { 5: node(5, { assignees: owner, comments: withTalk }) },
      cards: { 5: STATUS.ready },
    })
    go(w, 5, 'assigned')
    const post = w.writes.find((entry) => entry.kind === 'POST')
    expect(post.body).not.toContain('SECRET-PLAN')
  })

  it('shows a flag in the comment without acting on it', () => {
    const w = world({
      issues: {
        5: node(5, {
          assignees: owner,
          comments: claim(),
          labels: { nodes: [{ name: 'enhancement' }, { name: 'needs owner' }] },
        }),
      },
      cards: { 5: STATUS.ready },
    })
    go(w, 5, 'assigned')
    expect(editsOf(w)).toHaveLength(1)
    expect(w.writes.find((entry) => entry.kind === 'POST').body).toMatch(/owner/i)
  })
})

describe('flags are only reported', () => {
  it('moves nothing and changes no label or assignee for an issue that is assigned but never started', () => {
    const w = world({ issues: { 5: node(5, { assignees: owner }) }, cards: { 5: STATUS.backlog } })
    go(w, 5, 'assigned')
    expect(w.writes).toEqual([])
  })

  it('writes nothing but the card status and the one comment, on any path', () => {
    const w = world({
      issues: { 5: node(5, { assignees: owner, comments: claim() }) },
      cards: { 5: STATUS.ready },
    })
    go(w, 5, 'assigned')
    for (const entry of w.writes) {
      const ok =
        entry.kind === 'edit' ||
        (['POST', 'PATCH'].includes(entry.kind) && /\/comments(\/\d+)?$/.test(entry.path))
      expect(ok, JSON.stringify(entry)).toBe(true)
    }
  })
})
