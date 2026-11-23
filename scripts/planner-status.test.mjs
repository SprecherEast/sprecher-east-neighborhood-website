/**
 * The one rule for what a board card should say, from facts GitHub records (#1425). Test first: a
 * test for each of the five rows, each flag and the epic rule.
 */
import { describe, expect, it } from 'vitest'

import { boardStatus, claimBranch, FLAGS } from './planner-status.mjs'

const facts = (over = {}) => ({
  state: 'open',
  labels: [],
  assignees: [],
  problems: [],
  claimBranch: null,
  openPullRequests: 0,
  mergedPullRequests: 0,
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
    expect(result.reason).toContain('agent/x')
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
  it('flags an issue assigned but never started', () => {
    const result = boardStatus(facts({ assignees: ['a'] }))
    expect(result.flags).toContain(FLAGS.neverStarted)
  })

  it('does not flag an assigned issue that has a claim or a pull request', () => {
    expect(boardStatus(facts({ assignees: ['a'], claimBranch: 'x/y' })).flags).toEqual([])
    expect(boardStatus(facts({ assignees: ['a'], openPullRequests: 1 })).flags).toEqual([])
    expect(boardStatus(facts({ assignees: ['a'], mergedPullRequests: 1 })).flags).not.toContain(
      FLAGS.neverStarted,
    )
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
