/**
 * The planner app's check of the board it reads: it fails when the board cannot be read the way the
 * status rule needs, and counts what it saw. It knows nothing of sprints. Test first.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import * as rules from './planner-rules.mjs'
import { boardProblems, summarizeBoard } from './planner-rules.mjs'

describe('the board check and sprints', () => {
  it('has no sprint logic', () => {
    expect(Object.keys(rules).filter((name) => /sprint/i.test(name))).toEqual([])
    expect(readFileSync(new URL('./planner-rules.mjs', import.meta.url), 'utf8')).not.toMatch(
      /sprint|iteration/i,
    )
  })
})

describe('summarizeBoard', () => {
  it('counts the cards and those with no readable status', () => {
    expect(summarizeBoard([{ status: 'Done' }, { status: 'Ready' }, { title: 'x' }])).toEqual({
      cards: 3,
      withoutStatus: 1,
    })
  })
})

describe('boardProblems', () => {
  it('passes a readable board', () => {
    expect(boardProblems(summarizeBoard([{ status: 'Done' }, { status: 'Ready' }]))).toEqual([])
  })

  it('fails an empty board', () => {
    expect(boardProblems(summarizeBoard([]))).toContain('The board has no cards.')
  })

  it('fails when no card has a readable status, which means the card shape changed', () => {
    expect(boardProblems(summarizeBoard([{ title: 'x' }, { title: 'y' }])).join()).toMatch(
      /status/i,
    )
  })
})
