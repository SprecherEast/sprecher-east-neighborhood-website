/**
 * What the planner app does to a card when an event concerns its issue (#941, #1089, #1435): it
 * gathers that issue's facts, sets the card to what the one status rule says, and writes the reason
 * on the issue. No other card, label or assignee changes. Test first.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import * as board from './planner-board.mjs'
import { moveCard } from './planner-board.mjs'
import { BOARD_STATUS_MARKER } from './planner-comment.mjs'
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

/** A small GitHub: the issues it holds, the cards on the board, and a record of every write. */
function world({ issues, cards = {}, branches = [] }) {
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
    if (args[0] === 'api' && args.includes('-X')) {
      writes.push({
        kind: args[args.indexOf('-X') + 1],
        path: args.find((arg) => arg.startsWith('repos/')),
        body: args.at(-1).replace(/^body=/, ''),
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
const person = (body, authorAssociation = 'OWNER') => ({
  databaseId: 1,
  body,
  authorAssociation,
  author: { login: 'someone', __typename: 'User' },
})
const claim = (branch = 'agent/worker/5-x') => ({
  nodes: [person(`### [STEP] Claimed\n\n**Branch:** \`${branch}\`.`)],
})
/** The planner's own comment on an issue, as GitHub returns it; `set` is the status it last set. */
const plannerComment = (set, id = 77, login = 'planner') => ({
  databaseId: id,
  body: `${BOARD_STATUS_MARKER}\n${set ? `<!-- planner:set=${set} -->\n` : ''}old text`,
  authorAssociation: 'NONE',
  author: { login, __typename: 'Bot' },
})
const owner = { nodes: [{ login: 'someone' }] }
const readyLabels = {
  nodes: [{ name: 'enhancement' }, { name: 'ci' }, { name: 'priority: low' }, { name: 'ready' }],
}
const env = (number, action = 'assigned') => ({
  REPO: 'o/r',
  ISSUE: String(number),
  ACTION: action,
  ORG,
  PROJECT,
  PLANNER_APP_SLUG: 'planner',
})
const go = (w, number, action) =>
  moveCard({ run: w.run, env: env(number, action), policy, log: () => {} })
const editsOf = (w) => w.writes.filter((entry) => entry.kind === 'edit')
const commentsOf = (w) => w.writes.filter((entry) => entry.kind !== 'edit')
const optionFor = (status) => `opt${Object.values(STATUS).indexOf(status)}`
const claimed = (over = {}) => node(5, { assignees: owner, comments: claim(), ...over })

describe('an event moves the card by the rule', () => {
  it('sets the card to the rule status and writes the reason on the issue', () => {
    const w = world({ issues: { 5: claimed() }, cards: { 5: STATUS.ready } })
    go(w, 5, 'assigned')
    expect(editsOf(w)).toEqual([
      { kind: 'edit', item: 'item5', option: optionFor(STATUS.inProgress) },
    ])
    const posts = commentsOf(w)
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ kind: 'POST', path: 'repos/o/r/issues/5/comments' })
    expect(posts[0].body).toContain(BOARD_STATUS_MARKER)
    expect(posts[0].body).toContain('<!-- planner:set=In progress -->')
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
    const w = world({ issues: { 5: claimed() }, cards: { 5: STATUS.inProgress } })
    go(w, 5, action)
    expect(w.writes).toEqual([])
  })

  it('moves a Backlog card forward to Ready on a label event', () => {
    const w = world({
      issues: { 5: node(5, { labels: readyLabels }) },
      cards: { 5: STATUS.backlog },
    })
    go(w, 5, 'labeled')
    expect(editsOf(w)[0].option).toBe(optionFor(STATUS.ready))
  })

  it('treats a pull request that closes the issue, and a remote branch, as work started', () => {
    const closed = {
      nodes: [
        {
          number: 8,
          state: 'MERGED',
          merged: true,
          mergedAt: '2026-01-01T00:00:00Z',
          authorAssociation: 'OWNER',
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
    const onBoard = { nodes: [{ project: { number: Number(PROJECT), owner: { login: ORG } } }] }
    const sub = (number, projectItems) => ({
      number,
      state: 'OPEN',
      repository: { nameWithOwner: 'o/r' },
      projectItems,
    })
    const epic = node(5, {
      labels: { nodes: [{ name: 'epic' }] },
      subIssues: { nodes: [sub(6, onBoard), sub(7, { nodes: [] })] },
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
    expect(commentsOf(w).every((entry) => entry.path === 'repos/o/r/issues/5/comments')).toBe(true)
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

  it('puts a closed issue Done on a manual run, which also brings its card back onto the board', () => {
    const w = world({
      issues: { 5: node(5, { state: 'CLOSED' }) },
      cards: { 5: STATUS.inProgress },
    })
    go(w, 5, 'sync')
    expect(editsOf(w)[0].option).toBe(optionFor(STATUS.done))
  })

  it('refuses an issue that is not a number, and a run without the app name', () => {
    expect(() => moveCard({ run: () => '', env: { ...env(5), ISSUE: '5; rm' }, policy })).toThrow(
      /number/,
    )
    const bad = { ...env(5), PLANNER_APP_SLUG: '' }
    expect(() => moveCard({ run: () => '', env: bad, policy })).toThrow(/app/i)
  })

  it('sets a card that has no status, as the report shows it', () => {
    const w = world({ issues: { 5: node(5) }, cards: {} })
    go(w, 5, 'opened')
    expect(editsOf(w)[0].option).toBe(optionFor(STATUS.backlog))
  })
})

describe('an event never moves a card backwards on its own', () => {
  const lost = () => node(5) // the rule says Backlog

  it('holds a backward move for the owner and says so on the issue', () => {
    const w = world({ issues: { 5: lost() }, cards: { 5: STATUS.inProgress } })
    go(w, 5, 'edited')
    expect(editsOf(w)).toEqual([])
    expect(commentsOf(w)).toHaveLength(1)
    expect(commentsOf(w)[0].body).toMatch(/held for the owner's confirmation/i)
  })

  it('writes no second comment when the held move was already written', () => {
    const w = world({ issues: { 5: lost() }, cards: { 5: STATUS.inProgress } })
    go(w, 5, 'edited')
    const body = commentsOf(w)[0].body
    const again = world({
      issues: { 5: node(5, { comments: { nodes: [{ ...plannerComment(null), body }] } }) },
      cards: { 5: STATUS.inProgress },
    })
    go(again, 5, 'edited')
    expect(again.writes).toEqual([])
  })

  it('moves a card back when the planner itself set its current status', () => {
    const issue = node(5, { comments: { nodes: [plannerComment(STATUS.ready)] } })
    const w = world({ issues: { 5: issue }, cards: { 5: STATUS.ready } })
    go(w, 5, 'unlabeled')
    expect(editsOf(w)[0].option).toBe(optionFor(STATUS.backlog))
  })

  it('applies a held move on a manual run for the issue, which is the owner confirming it', () => {
    const w = world({ issues: { 5: lost() }, cards: { 5: STATUS.inProgress } })
    go(w, 5, 'sync')
    expect(editsOf(w)[0].option).toBe(optionFor(STATUS.backlog))
  })

  it('still applies a forward move on an event', () => {
    const w = world({
      issues: { 5: node(5, { labels: readyLabels }) },
      cards: { 5: STATUS.backlog },
    })
    go(w, 5, 'labeled')
    expect(editsOf(w)).toHaveLength(1)
  })
})

describe('the reason on the issue', () => {
  it('writes the reason before the card moves, so no card moves without one', () => {
    const w = world({ issues: { 5: claimed() }, cards: { 5: STATUS.ready } })
    go(w, 5, 'assigned')
    expect(w.writes.map((entry) => entry.kind)).toEqual(['POST', 'edit'])
  })

  it('edits the one Board status comment in place on a later move', () => {
    const issue = claimed({ comments: { nodes: [...claim().nodes, plannerComment(null)] } })
    const w = world({ issues: { 5: issue }, cards: { 5: STATUS.ready } })
    go(w, 5, 'assigned')
    expect(commentsOf(w)).toHaveLength(1)
    expect(commentsOf(w)[0]).toMatchObject({ kind: 'PATCH', path: 'repos/o/r/issues/comments/77' })
  })

  it('does not take over a look-alike comment from a person or from another app', () => {
    const body = `${BOARD_STATUS_MARKER}\nfake`
    const look = [
      { ...person(body), databaseId: 78 },
      { ...plannerComment(null, 79, 'github-actions'), body },
    ]
    const issue = claimed({ comments: { nodes: [...claim().nodes, ...look] } })
    const w = world({ issues: { 5: issue }, cards: { 5: STATUS.ready } })
    go(w, 5, 'assigned')
    expect(commentsOf(w).map((entry) => entry.kind)).toEqual(['POST'])
  })

  it("writes the reason for the planner's own moves to In review and Done too", () => {
    const closing = {
      nodes: [
        {
          number: 8,
          state: 'OPEN',
          merged: false,
          authorAssociation: 'OWNER',
          repository: { nameWithOwner: 'o/r' },
        },
      ],
    }
    const review = world({
      issues: { 5: node(5, { closedByPullRequestsReferences: closing }) },
      cards: { 5: STATUS.inProgress },
    })
    go(review, 5, 'sync')
    expect(editsOf(review)[0].option).toBe(optionFor(STATUS.inReview))
    expect(commentsOf(review)).toHaveLength(1)
    const done = world({
      issues: { 5: node(5, { state: 'CLOSED' }) },
      cards: { 5: STATUS.inProgress },
    })
    go(done, 5, 'sync')
    expect(editsOf(done)[0].option).toBe(optionFor(STATUS.done))
    expect(commentsOf(done)).toHaveLength(1)
  })

  it('is built from fixed sentences: no value read from GitHub text appears in it', () => {
    const issue = node(5, {
      title: 'TITLE-SENTINEL',
      assignees: owner,
      labels: { nodes: [{ name: 'needs owner' }, { name: 'LABEL-SENTINEL' }] },
      milestone: { title: 'MILESTONE-SENTINEL' },
      comments: {
        nodes: [
          person('talk: SECRET-SENTINEL www.evil.example'),
          ...claim('agent/worker/5-BRANCH-SENTINEL').nodes,
        ],
      },
    })
    const w = world({ issues: { 5: issue }, cards: { 5: STATUS.ready } })
    go(w, 5, 'assigned')
    const body = commentsOf(w)[0].body
    expect(body).not.toMatch(/SENTINEL|evil|agent\/worker/)
    const remote = world({
      issues: { 5: node(5, { assignees: owner }) },
      cards: { 5: STATUS.ready },
      branches: ['agent/worker/5-REMOTE-SENTINEL'],
    })
    go(remote, 5, 'assigned')
    expect(commentsOf(remote)[0].body).not.toMatch(/SENTINEL|agent\/worker/)
  })

  it('says what the rule gives and why, so it stays true if the edit fails', () => {
    const w = world({ issues: { 5: claimed() }, cards: { 5: STATUS.ready } })
    go(w, 5, 'assigned')
    const body = commentsOf(w)[0].body
    expect(body).not.toMatch(/moved this card/i)
    expect(body).toContain('In progress')
  })

  it('shows a flag in the comment without acting on it', () => {
    const labels = { nodes: [{ name: 'enhancement' }, { name: 'needs owner' }] }
    const w = world({ issues: { 5: claimed({ labels }) }, cards: { 5: STATUS.ready } })
    go(w, 5, 'assigned')
    expect(editsOf(w)).toHaveLength(1)
    expect(commentsOf(w)[0].body).toMatch(/owner/i)
  })
})

describe('whose words start work', () => {
  it('does not start work on a claim comment from an outside author', () => {
    const outsider = {
      nodes: [person('### [STEP] Claimed\n\nBranch: `agent/worker/5-x`', 'NONE')],
    }
    const w = world({
      issues: { 5: node(5, { assignees: owner, comments: outsider }) },
      cards: { 5: STATUS.backlog },
    })
    go(w, 5, 'assigned')
    expect(w.writes).toEqual([])
  })

  it('does not count a pull request from an outside fork as started work or In review', () => {
    const fork = {
      nodes: [
        {
          number: 8,
          state: 'OPEN',
          merged: false,
          authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
          repository: { nameWithOwner: 'o/r' },
        },
      ],
    }
    const w = world({
      issues: { 5: node(5, { assignees: owner, closedByPullRequestsReferences: fork }) },
      cards: { 5: STATUS.backlog },
    })
    go(w, 5, 'sync')
    expect(w.writes).toEqual([])
  })
})

describe('flags are only reported', () => {
  it('moves nothing and changes no label or assignee for an issue that is assigned but never started', () => {
    const w = world({ issues: { 5: node(5, { assignees: owner }) }, cards: { 5: STATUS.backlog } })
    go(w, 5, 'assigned')
    expect(w.writes).toEqual([])
  })

  it('writes nothing but the card status and the one comment, on any path', () => {
    const w = world({ issues: { 5: claimed() }, cards: { 5: STATUS.ready } })
    go(w, 5, 'assigned')
    for (const entry of w.writes) {
      const ok =
        entry.kind === 'edit' ||
        (['POST', 'PATCH'].includes(entry.kind) && /\/comments(\/\d+)?$/.test(entry.path))
      expect(ok, JSON.stringify(entry)).toBe(true)
    }
  })
})
