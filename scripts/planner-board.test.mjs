/**
 * What the planner app does to a card when its issue is opened, reopened or assigned: put it in
 * the sprint that is running now, and set In progress when work is assigned. Finished work keeps
 * its sprint and a card never moves backwards. Test first.
 */
import { describe, expect, it } from 'vitest'

import { decideChanges, findCurrentSprint } from './planner-board.mjs'

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
