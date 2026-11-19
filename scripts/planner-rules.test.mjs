/**
 * The planner app's one rule for sprints: work that finished in a sprint keeps that sprint, so the
 * sprint's history and burndown stay true. Only unfinished work moves forward. Test first (#903).
 */
import { describe, expect, it } from 'vitest'

import { boardProblems, canChangeSprint, isPastSprint, summarizeBoard } from './planner-rules.mjs'

const sprint = { title: 'Sprint A', startDate: '2026-10-26', duration: 7 }

describe('canChangeSprint', () => {
  it('refuses to move a Done card out of its sprint', () => {
    const result = canChangeSprint({ status: 'Done', sprint })
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/finished/i)
  })

  it('lets unfinished work move forward, also out of a past sprint', () => {
    expect(canChangeSprint({ status: 'In progress', sprint }).allowed).toBe(true)
    expect(canChangeSprint({ status: 'Ready', sprint }).allowed).toBe(true)
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
  const items = [
    { status: 'Done', sprint },
    { status: 'Done', sprint },
    { status: 'In progress', sprint },
    { status: 'Backlog' },
  ]

  it('counts the cards the rule protects and those in a past sprint', () => {
    expect(summarizeBoard(items, '2026-11-08')).toMatchObject({
      cards: 4,
      withSprint: 3,
      protectedCards: 2,
      inPastSprint: 3,
      withoutStatus: 0,
      malformedSprints: 0,
    })
  })

  it('reports cards with no status and sprints missing a start date or length', () => {
    const summary = summarizeBoard(
      [
        { sprint: { title: 'X' } },
        { status: 'Done', sprint: { startDate: '2026-10-26' } },
        { status: 'Ready' },
      ],
      '2026-11-08',
    )
    expect(summary).toMatchObject({ withoutStatus: 1, malformedSprints: 2 })
  })
})

describe('boardProblems', () => {
  it('passes a readable board, with or without sprints', () => {
    expect(
      boardProblems(summarizeBoard([{ status: 'Done' }, { status: 'Ready' }], '2026-11-08')),
    ).toEqual([])
  })

  it('fails an empty board', () => {
    expect(boardProblems(summarizeBoard([], '2026-11-08'))).toContain('The board has no cards.')
  })

  it('fails when no card has a readable status, which means the card shape changed', () => {
    expect(
      boardProblems(summarizeBoard([{ title: 'x' }, { title: 'y' }], '2026-11-08')).join(),
    ).toMatch(/status/i)
  })

  it('fails a sprint that cannot be read', () => {
    expect(
      boardProblems(
        summarizeBoard([{ status: 'Done', sprint: { title: 'X' } }], '2026-11-08'),
      ).join(),
    ).toMatch(/sprint/i)
  })
})
