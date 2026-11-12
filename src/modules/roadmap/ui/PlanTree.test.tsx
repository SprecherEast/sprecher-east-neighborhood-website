// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { Plan, PlanEpic, PlanIssue } from '../domain/types'
import { PlanTree } from './PlanTree'

afterEach(cleanup)

const NOW = new Date('2026-11-09T18:00:00Z')

const issue = (number: number, over: Partial<PlanIssue> = {}): PlanIssue => ({
  number,
  title: `Issue ${number}`,
  state: 'open',
  labels: [],
  description: '',
  closedAt: null,
  updatedAt: null,
  url: `https://github.com/o/r/issues/${number}`,
  ...over,
})

const epic = (number: number, children: PlanIssue[]): PlanEpic => ({
  ...issue(number, { labels: ['epic'] }),
  children,
})

const plan: Plan = {
  generatedAt: '2026-11-09T12:00:00Z',
  milestones: [
    {
      number: 1,
      title: 'Launch',
      description: 'Get the **site** out.',
      state: 'open',
      dueOn: '2026-12-01T00:00:00.000Z',
      epics: [
        epic(10, [
          issue(11),
          issue(12, { state: 'done', labels: ['bug'], closedAt: '2026-11-07T15:00:00Z' }),
          issue(13, { state: 'not-planned' }),
        ]),
      ],
    },
  ],
  unscheduled: [epic(20, [issue(21)])],
  hiddenCount: 4,
}

const renderTree = (over: Partial<Plan> = {}) =>
  render(<PlanTree plan={{ ...plan, ...over }} now={NOW} />)

describe('PlanTree', () => {
  it('shows each level as a box that opens', () => {
    const { container } = renderTree()
    expect(container.querySelectorAll('details')).toHaveLength(3)
    expect(screen.getByText('Launch')).toBeTruthy()
  })

  it('draws a progress bar for each milestone and epic, named with its count', () => {
    renderTree()
    expect(
      screen.getByRole('progressbar', { name: 'Launch: 1 of 2 done' }).getAttribute('value'),
    ).toBe('1')
    expect(screen.getByRole('progressbar', { name: 'Issue 10: 1 of 2 done' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Issue 20: 0 of 1 done' })).toBeTruthy()
  })

  it('says the progress in words: the count, the percent, what is open and what finished lately', () => {
    renderTree()
    const milestone = screen.getByText('Launch').closest('summary') as HTMLElement
    expect(within(milestone).getByText('50%')).toBeTruthy()
    expect(within(milestone).getByText(/1 of 2 done · 1 open · 1 done this week/)).toBeTruthy()
  })

  it('says when a milestone is due', () => {
    renderTree()
    expect(screen.getByText('Due Dec 1 · in 22 days')).toBeTruthy()
  })

  it('says an epic has no issues yet, with an empty bar', () => {
    renderTree({ unscheduled: [epic(30, [])] })
    const summary = screen.getByText('Issue 30').closest('summary') as HTMLElement
    expect(within(summary).getByText('No issues yet')).toBeTruthy()
    expect(within(summary).getByRole('progressbar').getAttribute('value')).toBe('0')
  })

  it('draws a milestone’s description as Markdown', () => {
    renderTree()
    expect(screen.getByText('site').tagName).toBe('STRONG')
  })

  it('links every issue, and every epic, to its own page', () => {
    renderTree()
    expect(screen.getByRole('link', { name: /Issue 11/ }).getAttribute('href')).toBe('/roadmap/11')
    expect(screen.getByRole('link', { name: /Issue 10/ }).getAttribute('href')).toBe('/roadmap/10')
  })

  it('says each issue’s state in words, and shows its labels', () => {
    renderTree()
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0)
    expect(screen.getByText('Done')).toBeTruthy()
    expect(screen.getByText('Not planned')).toBeTruthy()
    expect(screen.getByText('bug')).toBeTruthy()
  })

  it('says when a finished issue was closed', () => {
    renderTree()
    expect(screen.getByText('Closed Nov 7')).toBeTruthy()
  })

  it('puts epics with no milestone in their own group at the end', () => {
    renderTree()
    const heading = screen.getByRole('heading', { name: 'Not yet in a milestone' })
    expect(
      screen.getByText('Launch').compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('says how many issues are not shown, and leaves the note out when there are none', () => {
    const { rerender } = renderTree()
    expect(screen.getByText(/4 issues aren’t shown/)).toBeTruthy()
    rerender(<PlanTree plan={{ ...plan, hiddenCount: 1 }} now={NOW} />)
    expect(screen.getByText(/1 issue isn’t shown/)).toBeTruthy()
    rerender(<PlanTree plan={{ ...plan, hiddenCount: 0 }} now={NOW} />)
    expect(screen.queryByText(/shown/)).toBeNull()
  })

  it('has an empty state when the plan has nothing', () => {
    renderTree({ milestones: [], unscheduled: [] })
    expect(screen.getByText(/can’t show the plan/i)).toBeTruthy()
  })

  it('is accessible', async () => {
    const { container } = renderTree()
    await expectAccessible(container)
  })
})
