import { describe, expect, it } from 'vitest'

import { toOutcomeForkProps } from './outcomeFork'

describe('toOutcomeForkProps', () => {
  it('maps the question and outcomes to plain props', () => {
    expect(
      toOutcomeForkProps({
        question: ' Will they agree on cost? ',
        outcomes: [
          { title: 'If they agree', tone: 'go', description: ' Design starts. ' },
          { title: 'If they don’t', tone: 'stop', description: 'No new ramps.' },
        ],
      }),
    ).toEqual({
      question: 'Will they agree on cost?',
      outcomes: [
        { title: 'If they agree', tone: 'go', description: 'Design starts.' },
        { title: 'If they don’t', tone: 'stop', description: 'No new ramps.' },
      ],
    })
  })

  it('reads an unknown tone as open', () => {
    const { outcomes } = toOutcomeForkProps({
      question: 'Q?',
      outcomes: [
        { title: 'A', tone: 'maybe' as never, description: 'x' },
        { title: 'B', tone: 'go', description: 'y' },
      ],
    })
    expect(outcomes[0].tone).toBe('open')
  })

  it('is empty when it is not a fork: no question, or fewer than two titled outcomes', () => {
    const empty = { question: '', outcomes: [] }
    expect(
      toOutcomeForkProps({
        question: ' ',
        outcomes: [
          { title: 'A', tone: 'go', description: 'x' },
          { title: 'B', tone: 'go', description: 'y' },
        ],
      }),
    ).toEqual(empty)
    expect(
      toOutcomeForkProps({
        question: 'Q?',
        outcomes: [
          { title: 'A', tone: 'go', description: 'x' },
          { title: ' ', tone: 'go', description: 'y' },
        ],
      }),
    ).toEqual(empty)
  })
})
