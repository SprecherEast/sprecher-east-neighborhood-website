/**
 * What the planner app does to a card when its issue is opened, reopened, assigned or labeled: put
 * it in the sprint that is running now, set In progress when work is assigned, and move it between
 * Backlog and Ready as the `ready` label and the blocking labels say. Finished work keeps its
 * sprint and a card never moves back from In progress, In review or Done. Test first.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  decideChanges,
  findCurrentSprint,
  OWNER_LABEL,
  READY_LABEL,
  readyBlockers,
} from './planner-board.mjs'

const read = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'))

const current = { id: 'it-now', title: 'Sprint now', startDate: '2026-11-09', duration: 7 }
const past = { id: 'it-old', title: 'Sprint old', startDate: '2026-11-02', duration: 7 }

describe('findCurrentSprint', () => {
  const iterations = [past, current]

  it('finds the sprint that contains today', () => {
    expect(findCurrentSprint(iterations, '2026-11-09')).toEqual(current)
    expect(findCurrentSprint(iterations, '2026-11-15')).toEqual(current)
    expect(findCurrentSprint(iterations, '2026-11-05')).toEqual(past)
  })

  it('finds nothing between sprints or with no sprints', () => {
    expect(findCurrentSprint(iterations, '2026-11-16')).toBeUndefined()
    expect(findCurrentSprint([], '2026-11-09')).toBeUndefined()
  })
})

describe('decideChanges', () => {
  it('puts a new issue in the current sprint and leaves its status to the board', () => {
    const result = decideChanges({ action: 'opened', item: { status: 'Backlog' }, current })
    expect(result).toEqual({ sprintId: 'it-now' })
  })

  it('sets In progress and the current sprint when work is assigned', () => {
    const result = decideChanges({ action: 'assigned', item: { status: 'Ready' }, current })
    expect(result).toEqual({ status: 'In progress', sprintId: 'it-now' })
  })

  it('moves unfinished work forward out of a past sprint', () => {
    const item = { status: 'In progress', sprint: past }
    expect(decideChanges({ action: 'assigned', item, current })).toEqual({ sprintId: 'it-now' })
  })

  it('changes nothing when the card is already where it should be', () => {
    const item = { status: 'In progress', sprint: current }
    expect(decideChanges({ action: 'assigned', item, current })).toEqual({})
  })

  it('never moves a card back from In review or Done', () => {
    expect(
      decideChanges({
        action: 'assigned',
        item: { status: 'In review', sprint: current },
        current,
      }),
    ).toEqual({})
    expect(decideChanges({ action: 'assigned', item: { status: 'Done' }, current })).toEqual({
      sprintId: 'it-now',
    })
  })

  it('lets finished work keep its sprint', () => {
    const item = { status: 'Done', sprint: past }
    expect(decideChanges({ action: 'reopened', item, current })).toEqual({})
    expect(decideChanges({ action: 'assigned', item, current })).toEqual({})
  })

  it('changes no sprint when none is running, and still sets the status', () => {
    expect(decideChanges({ action: 'opened', item: { status: 'Backlog' } })).toEqual({})
    expect(decideChanges({ action: 'assigned', item: { status: 'Ready' } })).toEqual({
      status: 'In progress',
    })
  })

  it('ignores actions it does not handle', () => {
    expect(decideChanges({ action: 'labeled', item: { status: 'Ready' }, current })).toEqual({})
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
    decideChanges({ action: 'labeled', label, issue, item: { status, sprint: current }, current })

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
      item: { status: 'Ready', sprint: current },
      current,
    })
    expect(edited).toEqual({ status: 'Backlog' })
  })

  it('moves the card to Ready on the event that fixes the last gap', () => {
    const fixed = decideChanges({
      action: 'milestoned',
      issue: open(['ready']),
      item: { status: 'Backlog', sprint: current },
      current,
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
      item: { status: 'Ready', sprint: current },
      current,
    })
    expect(result).toEqual({ status: 'Backlog' })
  })

  it('leaves a Ready card alone when another label changes and the issue never had the label', () => {
    expect(labeled('frontend', open(['frontend']), 'Ready')).toEqual({})
    const result = decideChanges({
      action: 'unlabeled',
      label: 'frontend',
      issue: open([]),
      item: { status: 'Ready', sprint: current },
      current,
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
      item: { status, sprint: current },
      current,
    })
    expect(removed).toEqual({})
  })

  it('does not pull an old issue into the sprint because a label changed', () => {
    const item = { status: 'Backlog', sprint: past }
    expect(
      decideChanges({ action: 'labeled', label: 'ready', issue: open(['ready']), item, current }),
    ).toEqual({ status: 'Ready' })
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
      item: { status: 'Ready', sprint: current },
      current,
    })
    expect(result).toEqual({ status: 'In progress' })
  })
})

describe('decideChanges on a manual run', () => {
  const sync = (issue, item) => decideChanges({ action: 'sync', issue, item, current })

  it('claims an assigned issue: In progress and the current sprint', () => {
    const issue = { state: 'open', labels: ['ready'], assignees: ['someone'] }
    expect(sync(issue, { status: 'Ready', sprint: past })).toEqual({
      status: 'In progress',
      sprintId: 'it-now',
    })
  })

  it('brings an unassigned card in line with its labels, both ways', () => {
    const ready = { state: 'open', labels: ['ready'], assignees: [] }
    const plain = { state: 'open', labels: [], assignees: [] }
    expect(sync(ready, { status: 'Backlog', sprint: current })).toEqual({ status: 'Ready' })
    expect(sync(plain, { status: 'Ready', sprint: current })).toEqual({ status: 'Backlog' })
  })

  it('leaves a closed issue alone, also when it is assigned', () => {
    const closed = { state: 'closed', labels: [], assignees: ['someone'] }
    expect(sync(closed, { status: 'In progress', sprint: past })).toEqual({})
  })

  it('does not move an unassigned card into the sprint', () => {
    const plain = { state: 'open', labels: [], assignees: [] }
    expect(sync(plain, { status: 'Backlog', sprint: past })).toEqual({})
  })
})
