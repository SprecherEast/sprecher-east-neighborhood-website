/**
 * The planner app's one rule for sprints: work that finished in a sprint keeps that sprint, so the
 * sprint's history and burndown stay true. Only unfinished work moves forward. Test first (#903).
 */
import { describe, expect, it } from 'vitest'

import { canChangeSprint, isPastSprint, summarizeBoard } from './planner-rules.mjs'

const sprint = { title: 'Sprint A', startDate: '2026-10-26', duration: 7 }

describe('canChangeSprint', () => {
  it('refuses to move a Done card out of its sprint', () => {
    const result = canChangeSprint({ status: 'Done', sprint })
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/finished/i)
  })

  it('refuses when the issue is closed even if the status was not updated', () => {
    expect(
      canChangeSprint({ status: 'In review', sprint, content: { state: 'CLOSED' } }).allowed,
    ).toBe(false)
  })

  it('lets unfinished work move forward, also out of a past sprint', () => {
    expect(canChangeSprint({ status: 'In progress', sprint }).allowed).toBe(true)
    expect(canChangeSprint({ status: 'Ready', sprint, content: { state: 'OPEN' } }).allowed).toBe(
      true,
    )
  })

  it('allows a card that has no sprint yet, finished or not', () => {
    expect(canChangeSprint({ status: 'Done' }).allowed).toBe(true)
    expect(canChangeSprint({ status: 'Backlog' }).allowed).toBe(true)
  })
})

describe('isPastSprint', () => {
  it('is past once its last day has gone', () => {
    expect(isPastSprint(sprint, '2026-11-02')).toBe(true)
    expect(isPastSprint(sprint, '2026-11-01')).toBe(false)
    expect(isPastSprint(sprint, '2026-10-26')).toBe(false)
  })

  it('treats a missing sprint as not past', () => {
    expect(isPastSprint(undefined, '2026-11-08')).toBe(false)
  })
})

describe('summarizeBoard', () => {
  it('counts cards the rule protects and checks that the rule refuses every one', () => {
    const items = [
      { status: 'Done', sprint },
      { status: 'Done', sprint },
      { status: 'In progress', sprint },
      { status: 'Backlog' },
    ]
    expect(summarizeBoard(items, '2026-11-08')).toEqual({
      cards: 4,
      withSprint: 3,
      protectedCards: 2,
      inPastSprint: 3,
      allProtectedRefused: true,
    })
  })
})
