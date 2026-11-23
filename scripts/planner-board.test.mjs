/**
 * What the planner app does to a card when its issue is opened, reopened, assigned or labeled: set
 * In progress when work is assigned, and move it between Backlog and Ready as the `ready` label and
 * the blocking labels say. A card never moves back from In progress, In review or Done, and the app
 * reads and writes no other board field. Test first.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import * as board from './planner-board.mjs'
import { decideChanges, OWNER_LABEL, READY_LABEL, readyBlockers } from './planner-board.mjs'

const read = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'))

describe('the planner app and sprints', () => {
  it('has no sprint logic', () => {
    expect(Object.keys(board).filter((name) => /sprint/i.test(name))).toEqual([])
    expect(readFileSync(new URL('./planner-board.mjs', import.meta.url), 'utf8')).not.toMatch(
      /sprint|iteration/i,
    )
  })
})

describe('decideChanges', () => {
  it('leaves a new or reopened issue to the board', () => {
    expect(decideChanges({ action: 'opened', item: { status: 'Backlog' } })).toEqual({})
    expect(decideChanges({ action: 'reopened', item: { status: 'Backlog' } })).toEqual({})
  })

  it('sets In progress when work is assigned', () => {
    expect(decideChanges({ action: 'assigned', item: { status: 'Ready' } })).toEqual({
      status: 'In progress',
    })
  })

  it('changes nothing when the card is already where it should be', () => {
    expect(decideChanges({ action: 'assigned', item: { status: 'In progress' } })).toEqual({})
  })

  it('never moves a card back from In review or Done', () => {
    expect(decideChanges({ action: 'assigned', item: { status: 'In review' } })).toEqual({})
    expect(decideChanges({ action: 'assigned', item: { status: 'Done' } })).toEqual({})
  })

  it('sets and reads no field other than the status', () => {
    for (const action of ['opened', 'reopened', 'assigned', 'sync']) {
      const changes = decideChanges({ action, item: { status: 'Ready' } })
      expect(Object.keys(changes).filter((key) => key !== 'status')).toEqual([])
    }
  })

  it('ignores actions it does not handle', () => {
    expect(decideChanges({ action: 'labeled', item: { status: 'Ready' } })).toEqual({})
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
})

describe('decideChanges with the ready label', () => {
  const open = (labels = [], assignees = [], problems = []) => ({
    state: 'open',
    labels,
    assignees,
    problems,
  })
  const failing = ['ISSUE-MILESTONE: Set a milestone (Backlog until it is planned).']
  const labeled = (label, issue, status) =>
    decideChanges({ action: 'labeled', label, issue, item: { status } })

  it('moves a Backlog card to Ready when the issue has the label and nothing blocks it', () => {
    expect(labeled('ready', open(['ready']), 'Backlog')).toEqual({ status: 'Ready' })
  })

  it('catches up on any later label event, so a dropped run does not leave the card behind', () => {
    expect(labeled('frontend', open(['ready', 'frontend']), 'Backlog')).toEqual({ status: 'Ready' })
  })

  it('leaves the card in Backlog while the issue waits for the owner', () => {
    const issue = open(['ready', 'needs owner'])
    expect(labeled('ready', issue, 'Backlog')).toEqual({})
    expect(readyBlockers(issue)).toEqual(['needs owner'])
  })

  it('leaves the card in Backlog while the issue fails the issue check', () => {
    const issue = open(['ready'], [], failing)
    expect(labeled('ready', issue, 'Backlog')).toEqual({})
    expect(readyBlockers(issue)).toEqual(failing)
  })

  it('moves a Ready card back when either blocker appears, on any event', () => {
    expect(labeled('needs owner', open(['ready', 'needs owner']), 'Ready')).toEqual({
      status: 'Backlog',
    })
    const edited = decideChanges({
      action: 'edited',
      issue: open(['ready'], [], failing),
      item: { status: 'Ready' },
    })
    expect(edited).toEqual({ status: 'Backlog' })
  })

  it('moves the card to Ready on the event that fixes the last gap', () => {
    const fixed = decideChanges({
      action: 'milestoned',
      issue: open(['ready']),
      item: { status: 'Backlog' },
    })
    expect(fixed).toEqual({ status: 'Ready' })
  })

  it('catches up on a removed label from the history when its own run was dropped', () => {
    const issue = { ...open(['frontend']), readyRemoved: true }
    expect(labeled('frontend', issue, 'Ready')).toEqual({ status: 'Backlog' })
  })

  it('parks a Ready card in Backlog when the label is removed', () => {
    const result = decideChanges({
      action: 'unlabeled',
      label: 'ready',
      issue: open([]),
      item: { status: 'Ready' },
    })
    expect(result).toEqual({ status: 'Backlog' })
  })

  it('leaves a Ready card alone when another label changes and the issue never had the label', () => {
    expect(labeled('frontend', open(['frontend']), 'Ready')).toEqual({})
    const result = decideChanges({
      action: 'unlabeled',
      label: 'frontend',
      issue: open([]),
      item: { status: 'Ready' },
    })
    expect(result).toEqual({})
  })

  it.each(['In progress', 'In review', 'Done'])('never moves a card that is %s', (status) => {
    expect(labeled('ready', open(['ready']), status)).toEqual({})
    expect(labeled('needs owner', open(['needs owner']), status)).toEqual({})
    const removed = decideChanges({
      action: 'unlabeled',
      label: 'ready',
      issue: open([]),
      item: { status },
    })
    expect(removed).toEqual({})
  })

  it('does not claim an issue because a label changed while it is assigned', () => {
    expect(labeled('frontend', open(['frontend'], ['someone']), 'Backlog')).toEqual({})
  })

  it('changes nothing on a closed issue', () => {
    const closed = { state: 'closed', labels: ['ready'], assignees: [] }
    expect(labeled('ready', closed, 'Backlog')).toEqual({})
  })

  it('still sets In progress when a Ready issue is assigned', () => {
    const result = decideChanges({
      action: 'assigned',
      issue: open(['ready'], ['someone']),
      item: { status: 'Ready' },
    })
    expect(result).toEqual({ status: 'In progress' })
  })
})

describe('decideChanges on a manual run', () => {
  const sync = (issue, item) => decideChanges({ action: 'sync', issue, item })

  it('claims an assigned issue: In progress', () => {
    const issue = { state: 'open', labels: ['ready'], assignees: ['someone'] }
    expect(sync(issue, { status: 'Ready' })).toEqual({
      status: 'In progress',
    })
  })

  it('brings an unassigned card in line with its labels, both ways', () => {
    const ready = { state: 'open', labels: ['ready'], assignees: [] }
    const plain = { state: 'open', labels: [], assignees: [] }
    expect(sync(ready, { status: 'Backlog' })).toEqual({ status: 'Ready' })
    expect(sync(plain, { status: 'Ready' })).toEqual({ status: 'Backlog' })
  })

  it('leaves a closed issue alone, also when it is assigned', () => {
    const closed = { state: 'closed', labels: [], assignees: ['someone'] }
    expect(sync(closed, { status: 'In progress' })).toEqual({})
  })
})
