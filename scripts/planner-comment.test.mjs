/**
 * The one "Board status" comment per issue (#1435): built from fixed sentences only, found again by
 * a hidden marker and the app's own login, and it records the status the planner last set. Test first.
 */
import { describe, expect, it } from 'vitest'

import {
  BOARD_STATUS_MARKER,
  boardStatusComment,
  findStatusComment,
  plannerSetStatus,
} from './planner-comment.mjs'

const result = { status: 'In progress', reason: 'It is assigned.', flags: ['A flag.'] }

describe('boardStatusComment', () => {
  it('starts with the marker and a heading that does not name a status', () => {
    const body = boardStatusComment({ from: 'Ready', result })
    expect(body.startsWith(BOARD_STATUS_MARKER)).toBe(true)
    expect(body).toContain('### Board status\n')
  })

  it('says what the rule gives and why, as true whether or not the card moved', () => {
    const body = boardStatusComment({ from: 'Ready', result })
    expect(body).toContain('Ready')
    expect(body).toContain('In progress')
    expect(body).toContain('It is assigned.')
    expect(body).toContain('A flag.')
    expect(body).not.toMatch(/moved this card/i)
  })

  it('records the status it set, so a later run knows the planner set it', () => {
    expect(plannerSetStatus(boardStatusComment({ from: 'Ready', result }))).toBe('In progress')
  })

  it('says a backward move is held for the owner, and keeps the status the planner last set', () => {
    const held = boardStatusComment({
      from: 'In progress',
      result: { ...result, status: 'Backlog' },
      held: true,
      set: 'Ready',
    })
    expect(held).toMatch(/held for the owner's confirmation/i)
    expect(held).toMatch(/nothing was moved/i)
    expect(plannerSetStatus(held)).toBe('Ready')
  })

  it('records no status when the planner set none yet and the move is held', () => {
    const held = boardStatusComment({ from: 'Done', result, held: true, set: null })
    expect(plannerSetStatus(held)).toBeNull()
  })
})

describe('findStatusComment', () => {
  const mine = { id: 7, type: 'Bot', login: 'planner[bot]', body: `${BOARD_STATUS_MARKER}\nold` }
  const find = (comments) => findStatusComment(comments, 'planner')

  it('finds the comment by its marker and the app own login, with or without [bot]', () => {
    expect(find([mine])).toEqual(mine)
    expect(find([{ ...mine, login: 'planner' }])).not.toBeNull()
  })

  it('never takes over a person, another bot or another app', () => {
    const person = { ...mine, id: 3, type: 'User', login: 'someone' }
    const otherBot = { ...mine, id: 4, login: 'github-actions[bot]' }
    const plain = { ...mine, id: 5, body: 'something else' }
    expect(find([person, otherBot, plain])).toBeNull()
  })
})

describe('plannerSetStatus', () => {
  it('is null for a body with no record', () => {
    expect(plannerSetStatus(`${BOARD_STATUS_MARKER}\nhello`)).toBeNull()
    expect(plannerSetStatus(undefined)).toBeNull()
  })
})
