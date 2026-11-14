// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { Plan, PlanEpic, PlanIssue } from '../domain/types'
import { PlanSummary } from './PlanSummary'

afterEach(cleanup)

// Fri 2026-11-13 at noon in Chicago
const NOW = new Date('2026-11-13T18:00:00Z')

const issue = (number: number, over: Partial<PlanIssue> = {}): PlanIssue => ({
  number,
  title: `Issue ${number}`,
  state: 'open',
  labels: [],
  description: '',
  url: '',
  createdAt: '2026-10-01T18:00:00Z',
  closedAt: null,
  updatedAt: null,
  ...over,
})

const epic = (children: PlanIssue[]): PlanEpic => ({ ...issue(100), children })

const plan = (children: PlanIssue[]): Plan => ({
  generatedAt: '2026-11-13T18:00:00Z',
  milestones: [],
  unscheduled: [epic(children)],
  hiddenCount: 0,
})

const children = [
  issue(1),
  issue(2),
  issue(3, { state: 'done', closedAt: '2026-11-13T15:00:00Z' }),
  issue(4, { state: 'done', closedAt: '2026-11-12T15:00:00Z' }),
  issue(5, { state: 'done', closedAt: '2026-11-01T15:00:00Z' }),
  issue(6, { state: 'done', closedAt: '2026-08-01T15:00:00Z' }),
]

const figure = (name: string) => screen.getByTestId(`figure-${name}`).textContent

describe('PlanSummary', () => {
  it('draws three named graphs and the four-week map, each listing its values', () => {
    render(<PlanSummary plan={plan(children)} now={NOW} />)
    const graphs = screen.getAllByRole('img')
    expect(graphs).toHaveLength(4)
    expect(screen.getByRole('img', { name: /^Finished each day.*: .*\b1\b/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /^Done in all/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /^Still open/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /^Activity over four weeks/ })).toBeTruthy()
  })

  it('gives each graph one small figure: finished this week, done in all, still open', () => {
    render(<PlanSummary plan={plan(children)} now={NOW} />)
    expect(figure('finished')).toBe('2')
    expect(figure('done')).toBe('4')
    expect(figure('open')).toBe('2')
  })

  it('counts a week as the last seven days, today included', () => {
    const week = [
      issue(1, { state: 'done', closedAt: '2026-11-07T15:00:00Z' }),
      issue(2, { state: 'done', closedAt: '2026-11-06T15:00:00Z' }),
    ]
    render(<PlanSummary plan={plan(week)} now={NOW} />)
    expect(figure('finished')).toBe('1')
  })

  it('keeps the updated line and has no explanatory sentences or insider words', () => {
    const { container } = render(<PlanSummary plan={plan(children)} now={NOW} />)
    expect(screen.getByText(/Updated/)).toBeTruthy()
    expect(container.textContent).not.toMatch(/straight from|milestone|epic/i)
  })

  it('is accessible', async () => {
    const { container } = render(<PlanSummary plan={plan(children)} now={NOW} />)
    await expectAccessible(container)
  })
})
