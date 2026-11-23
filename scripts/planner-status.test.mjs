/**
 * The one rule for what a board card should say, from facts GitHub records (#1425). Test first: a
 * test for each of the five rows, each flag and the epic rule.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { boardStatus, claimBranch, FLAGS, issueOfBranch, settleCards } from './planner-status.mjs'

const facts = (over = {}) => ({
  state: 'open',
  labels: [],
  assignees: [],
  problems: [],
  claimBranch: null,
  remoteBranch: null,
  openPullRequests: 0,
  mergedPullRequests: 0,
  pullRequests: 0,
  children: [],
  parent: null,
  ...over,
})

describe('claimBranch', () => {
  it('reads the branch from a STEP claim comment', () => {
    const body =
      '### [STEP] Claimed, with the brief\n\n**Branch:** `agent/worker/1-x`. Depends on: none'
    expect(claimBranch([{ body: 'hello' }, { body }])).toBe('agent/worker/1-x')
  })

  it('reads the Branch line of the dispatch brief template, so the two always agree', () => {
    const skill = readFileSync(
      new URL('../.agents/skills/chief-of-staff/SKILL.md', import.meta.url),
      'utf8',
    )
    const line = skill.split('\n').find((text) => text.startsWith('**Branch:**'))
    expect(line, 'the brief template has a Branch line').toBeTruthy()
    const body = `### [STEP] Brief for x\n\n${line.replace('<name>', 'agent/worker/12-sample')}`
    expect(claimBranch([{ body }])).toBe('agent/worker/12-sample')
  })

  it('takes only a plain branch name, so a claim comment cannot put a mention or link in a reason', () => {
    expect(claimBranch([{ body: '### [STEP] x\n\nBranch: `@someone`' }])).toBeNull()
    expect(claimBranch([{ body: '### [STEP] x\n\nBranch: `a](http://b)`' }])).toBeNull()
  })

  it('ignores comments that are not a STEP or name no branch', () => {
    expect(claimBranch([{ body: 'Branch: `a/b`' }, { body: '### [STEP] Claimed' }])).toBeNull()
    expect(claimBranch([])).toBeNull()
  })
})

describe('boardStatus: the five rows', () => {
  it('1. a closed issue is Done, even with an open pull request or a claim', () => {
    const result = boardStatus(
      facts({ state: 'closed', openPullRequests: 1, assignees: ['a'], claimBranch: 'b/c' }),
    )
    expect(result.status).toBe('Done')
    expect(result.reason).toMatch(/closed/i)
  })

  it('2. an open pull request that closes it is In review', () => {
    const result = boardStatus(facts({ openPullRequests: 1, labels: ['ready'] }))
    expect(result.status).toBe('In review')
    expect(result.reason).toMatch(/pull request/i)
  })

  it('3. assigned with a claim naming a branch is In progress, however quiet', () => {
    const result = boardStatus(facts({ assignees: ['a'], claimBranch: 'agent/x' }))
    expect(result.status).toBe('In progress')
    expect(result.reason).toMatch(/claim comment names a branch/)
    expect(result.reason, 'the branch name is text from a comment').not.toContain('agent/x')
  })

  it('3. a claim comment without an assignee, or an assignee without a claim, is not a claim', () => {
    expect(boardStatus(facts({ claimBranch: 'agent/x' })).status).toBe('Backlog')
    expect(boardStatus(facts({ assignees: ['a'] })).status).toBe('Backlog')
  })

  it('4. the ready label, a passing issue check and no needs owner is Ready', () => {
    expect(boardStatus(facts({ labels: ['ready'] })).status).toBe('Ready')
  })

  it('4. needs owner, a failed check or no label keeps it out of Ready', () => {
    expect(boardStatus(facts({ labels: ['ready', 'needs owner'] })).status).toBe('Backlog')
    expect(boardStatus(facts({ labels: ['ready'], problems: ['ISSUE-TYPE'] })).status).toBe(
      'Backlog',
    )
    expect(boardStatus(facts()).status).toBe('Backlog')
  })

  it('3 beats 4: a claimed issue with the ready label is In progress', () => {
    const result = boardStatus(
      facts({ labels: ['ready'], assignees: ['a'], claimBranch: 'agent/x' }),
    )
    expect(result.status).toBe('In progress')
  })

  it('5. anything else open is Backlog, with a reason', () => {
    const result = boardStatus(facts())
    expect(result).toMatchObject({ status: 'Backlog', flags: [] })
    expect(result.reason.length).toBeGreaterThan(10)
  })
})

describe('boardStatus: epics follow their children', () => {
  const epic = (children, over = {}) =>
    facts({ labels: ['epic'], assignees: ['a'], claimBranch: 'agent/x', children, ...over })

  it('never takes its status from its assignee or claim', () => {
    expect(boardStatus(epic([{ status: 'Ready' }])).status).toBe('Backlog')
  })

  it('is In progress while a child is In progress or In review', () => {
    expect(boardStatus(epic([{ status: 'Done' }, { status: 'In progress' }])).status).toBe(
      'In progress',
    )
    expect(boardStatus(epic([{ status: 'In review' }])).status).toBe('In progress')
  })

  it('is Done when closed', () => {
    expect(boardStatus(epic([], { state: 'closed' })).status).toBe('Done')
  })
})

describe('boardStatus: flags (reported, never acted on)', () => {
  it('says what the never-started flag means: a pull request that closes it or says it does', () => {
    expect(FLAGS.neverStarted).toMatch(/no pull request closes this issue or says it does/)
    expect(FLAGS.neverStarted).not.toMatch(/no pull request exists/)
  })

  it('flags an issue assigned but never started', () => {
    const result = boardStatus(facts({ assignees: ['a'] }))
    expect(result.flags).toContain(FLAGS.neverStarted)
  })

  it('does not flag an assigned issue that has a claim or a pull request', () => {
    expect(boardStatus(facts({ assignees: ['a'], claimBranch: 'x/y' })).flags).toEqual([])
    expect(boardStatus(facts({ assignees: ['a'], pullRequests: 1 })).flags).toEqual([])
  })

  it('counts any pull request that closes or declares it closes the issue as a start', () => {
    // open, merged, closed, or merged and then reopened: all are `pullRequests`
    const result = boardStatus(facts({ assignees: ['a'], pullRequests: 1, mergedPullRequests: 0 }))
    expect(result.flags).not.toContain(FLAGS.neverStarted)
  })

  it('flags a merged pull request on an issue that is still open', () => {
    expect(boardStatus(facts({ mergedPullRequests: 1 })).flags).toContain(FLAGS.mergedStillOpen)
    expect(boardStatus(facts({ state: 'closed', mergedPullRequests: 1 })).flags).toEqual([])
  })

  it('flags an open epic whose children are all closed', () => {
    const epic = facts({ labels: ['epic'], children: [{ status: 'Done' }, { status: 'Done' }] })
    expect(boardStatus(epic).flags).toContain(FLAGS.epicChildrenDone)
    expect(boardStatus({ ...epic, children: [] }).flags).not.toContain(FLAGS.epicChildrenDone)
    expect(boardStatus({ ...epic, children: [{ status: 'Ready' }] }).flags).toEqual([])
  })

  it('flags an open child of a closed parent', () => {
    expect(boardStatus(facts({ parent: { state: 'closed' } })).flags).toContain(
      FLAGS.openUnderClosed,
    )
    expect(boardStatus(facts({ parent: { state: 'open' } })).flags).toEqual([])
  })
})

describe('issueOfBranch', () => {
  it('reads the issue number from a branch that follows the claim naming pattern', () => {
    expect(issueOfBranch('agent/worker/1435-planner-uses-status-rule')).toBe(1435)
    expect(issueOfBranch('agent/ops-lead/7-x')).toBe(7)
  })

  it('refuses a name that does not follow the pattern', () => {
    for (const name of [
      'main',
      'agent/worker/x-1',
      'agent/worker/12',
      'feature/12-x',
      'agent/12-x',
    ]) {
      expect(issueOfBranch(name), name).toBeNull()
    }
  })
})

describe('boardStatus: started work shows in three ways', () => {
  const assigned = { assignees: ['a'] }

  it.each([
    ['a claim comment names a branch', { claimBranch: 'agent/worker/1-x' }, /claim comment/],
    ['a pull request in any state closes it or says it does', { pullRequests: 1 }, /pull request/],
    [
      'a claim-named branch exists on the remote',
      { remoteBranch: 'agent/worker/1-y' },
      'agent/worker/1-y',
    ],
  ])('is In progress when assigned and %s', (_name, over, reason) => {
    const result = boardStatus(facts({ ...assigned, ...over }))
    expect(result.status).toBe('In progress')
    expect(result.reason).toMatch(reason)
    expect(result.reason).not.toMatch(/agent\//)
    expect(result.flags).toEqual([])
  })

  it('does not count assignment alone as a start', () => {
    expect(boardStatus(facts(assigned)).status).toBe('Backlog')
  })

  it('does not claim an issue nobody holds, whatever work is on record for it', () => {
    expect(boardStatus(facts({ pullRequests: 1 })).status).toBe('Backlog')
    expect(boardStatus(facts({ remoteBranch: 'agent/worker/1-y' })).status).toBe('Backlog')
  })

  it('keeps a claimed issue In progress however long it has been quiet', () => {
    // nothing in the facts is a time: the same facts give the same status on any day
    const quiet = facts({ ...assigned, claimBranch: 'agent/worker/1-x' })
    expect(boardStatus(quiet).status).toBe(boardStatus({ ...quiet }).status)
    expect(boardStatus(quiet).status).toBe('In progress')
  })

  it('leaves an open pull request first: a claimed issue with one is In review', () => {
    expect(
      boardStatus(facts({ ...assigned, claimBranch: 'a/b', openPullRequests: 1 })).status,
    ).toBe('In review')
  })

  it('does not flag an assigned issue with only a remote branch as never started', () => {
    expect(boardStatus(facts({ ...assigned, remoteBranch: 'agent/worker/1-y' })).flags).toEqual([])
  })
})

describe('boardStatus: needs owner beside a claim', () => {
  it('keeps a claimed issue In progress and shows needs owner as a flag', () => {
    const result = boardStatus(
      facts({ assignees: ['a'], claimBranch: 'agent/x', labels: ['needs owner'] }),
    )
    expect(result.status).toBe('In progress')
    expect(result.flags).toContain(FLAGS.waitsForOwner)
  })

  it('raises no such flag on an issue that is not claimed', () => {
    expect(boardStatus(facts({ labels: ['needs owner'] })).flags).toEqual([])
  })
})

describe('settleCards', () => {
  const card = (key, over = {}) => ({ key, facts: facts(over) })
  const child = (key, state = 'open') => ({ key, state })

  it('gives every card the rule status, an epic after its children', () => {
    const settled = settleCards([
      card('o/r#10', { labels: ['epic'], subIssues: [child('o/r#11')] }),
      card('o/r#11', { assignees: ['a'], claimBranch: 'x/y' }),
    ])
    expect(settled.get('o/r#10').status).toBe('In progress')
    expect(settled.get('o/r#11').status).toBe('In progress')
  })

  it('counts a sub-issue that is not on the board as Backlog for its epic', () => {
    const settled = settleCards([
      card('o/r#10', { labels: ['epic'], subIssues: [child('o/r#99')] }),
    ])
    expect(settled.get('o/r#10').status).toBe('Backlog')
  })

  it('keys cards by repository and number, so the same number elsewhere is another issue', () => {
    const settled = settleCards([
      card('o/r#10', { labels: ['epic'], subIssues: [child('o/r#11')] }),
      card('o/other#11', { assignees: ['a'], claimBranch: 'x/y' }),
    ])
    expect(settled.get('o/r#10').status).toBe('Backlog')
  })

  it('settles an epic under an epic before its parent, whatever the order', () => {
    const settled = settleCards([
      card('o/r#10', { labels: ['epic'], subIssues: [child('o/r#20')] }),
      card('o/r#20', { labels: ['epic'], subIssues: [child('o/r#21')] }),
      card('o/r#21', { assignees: ['a'], claimBranch: 'x/y' }),
    ])
    expect([10, 20, 21].map((n) => settled.get(`o/r#${n}`).status)).toEqual([
      'In progress',
      'In progress',
      'In progress',
    ])
  })

  it('treats a closed child as Done and flags an epic whose children are all closed', () => {
    const settled = settleCards([
      card('o/r#10', { labels: ['epic'], subIssues: [child('o/r#11', 'closed')] }),
    ])
    expect(settled.get('o/r#10').flags.join(' ')).toMatch(/every child/i)
  })
})

describe('isBackwards', () => {
  it('follows the column order: Backlog, Ready, In progress, In review, Done', () => {
    expect(isBackwards('Ready', 'Backlog')).toBe(true)
    expect(isBackwards('Done', 'In progress')).toBe(true)
    expect(isBackwards('In review', 'In progress')).toBe(true)
    expect(isBackwards('Backlog', 'Ready')).toBe(false)
    expect(isBackwards('In progress', 'In progress')).toBe(false)
  })

  it('counts a card with no status as before every column', () => {
    expect(isBackwards(null, 'Backlog')).toBe(false)
  })
})

describe('decideChanges: an event never moves a card backwards on its own', () => {
  const result = (status) => ({ status, reason: 'why', flags: [] })
  const decide = (to, from, over = {}) =>
    decideChanges({ result: result(to), item: { status: from }, action: 'edited', ...over })

  it('changes nothing when the card already says what the rule gives', () => {
    expect(decide('Ready', 'Ready')).toEqual({})
  })

  it('applies a forward move on an event', () => {
    expect(decide('In progress', 'Ready')).toEqual({ status: 'In progress' })
    expect(decide('Backlog', null)).toEqual({ status: 'Backlog' })
  })

  it('holds a backward move for the owner when the planner did not set the card', () => {
    expect(decide('Backlog', 'In progress')).toEqual({ held: 'Backlog' })
    expect(decide('Backlog', 'In progress', { plannerSet: 'Ready' })).toEqual({ held: 'Backlog' })
  })

  it('moves back a card whose current status the planner itself set', () => {
    expect(decide('Backlog', 'Ready', { plannerSet: 'Ready' })).toEqual({ status: 'Backlog' })
  })

  it('applies the held move on a manual run for the issue, which is the owner confirming it', () => {
    expect(decide('Backlog', 'In progress', { action: 'sync' })).toEqual({ status: 'Backlog' })
  })
})
