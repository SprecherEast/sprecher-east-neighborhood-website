// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { PlanMilestone } from '../domain/types'
import { MissionFigures } from './MissionFigures'

afterEach(cleanup)

const issue = (number: number, state: 'open' | 'done') => ({
  number,
  title: `Issue ${number}`,
  state,
  labels: [],
  description: '',
  closedAt: state === 'done' ? '2026-11-07T15:00:00Z' : null,
  createdAt: null,
  updatedAt: null,
  url: `https://github.com/o/r/issues/${number}`,
})

const mission: PlanMilestone = {
  number: 1,
  title: 'A mission',
  description: '',
  state: 'open',
  dueOn: null,
  epics: [
    { ...issue(10, 'open'), labels: ['epic'], children: [issue(11, 'done'), issue(12, 'open')] },
  ],
}

const NOW = new Date('2026-11-09T18:00:00Z')

const renderFigures = (size: 'tile' | 'page') =>
  render(
    <MissionFigures
      mission={mission}
      series={[0, 2, 1]}
      max={2}
      stepLabel="weeks"
      size={size}
      now={NOW}
    />,
  )

describe('MissionFigures', () => {
  it('says how many are done, in a named bar, and the news in words', () => {
    renderFigures('tile')
    expect(screen.getByRole('progressbar', { name: 'A mission: 1 of 2 done' })).toBeTruthy()
    expect(screen.getByText('1 finished this week')).toBeTruthy()
  })

  it('writes the numbers behind the picture only on the mission page', () => {
    renderFigures('tile')
    expect(screen.queryByText(/Last 3 weeks/)).toBeNull()
    cleanup()
    renderFigures('page')
    expect(screen.getByText(/Last 3 weeks: 0, 2, 1 · 1 finished this week/)).toBeTruthy()
  })
})
