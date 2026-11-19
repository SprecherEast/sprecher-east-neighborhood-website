import { describe, expect, it } from 'vitest'

import { cardMoves, cardVerdict } from './card-history.mjs'

const move = (login, type, at) => ({
  event: 'project_v2_item_status_changed',
  created_at: at,
  actor: { login, type },
})

describe('cardMoves', () => {
  it('lists only the status changes, oldest first', () => {
    const moves = cardMoves([
      { event: 'labeled', created_at: '2026-01-01T00:00:03Z', actor: { login: 'a', type: 'User' } },
      move('sprecher-east-planner[bot]', 'Bot', '2026-01-01T00:00:02Z'),
      move('github-project-automation[bot]', 'Bot', '2026-01-01T00:00:01Z'),
    ])
    expect(moves.map((m) => m.actor)).toEqual([
      'github-project-automation[bot]',
      'sprecher-east-planner[bot]',
    ])
  })
})

describe('cardVerdict', () => {
  it('passes when only bots moved the card', () => {
    const verdict = cardVerdict([
      move('github-project-automation[bot]', 'Bot', '2026-01-01T00:00:01Z'),
      move('sprecher-east-planner[bot]', 'Bot', '2026-01-01T00:00:02Z'),
    ])
    expect(verdict.ok).toBe(true)
    expect(verdict.byHand).toEqual([])
  })

  it('flags a move made by a person or a session using a person login', () => {
    const verdict = cardVerdict([
      move('github-project-automation[bot]', 'Bot', '2026-01-01T00:00:01Z'),
      move('boulaajaj', 'User', '2026-01-01T00:00:02Z'),
    ])
    expect(verdict.ok).toBe(false)
    expect(verdict.byHand).toEqual([{ at: '2026-01-01T00:00:02Z', actor: 'boulaajaj' }])
  })

  it('passes a card that never moved', () => {
    expect(cardVerdict([]).ok).toBe(true)
  })
})
