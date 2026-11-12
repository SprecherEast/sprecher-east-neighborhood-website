// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { Plan, PlanEpic, PlanIssue, PlanMilestone } from '../domain/types'
import { PlanTiles } from './PlanTiles'

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

const mission = (number: number, title: string, epics: PlanEpic[]): PlanMilestone => ({
  number,
  title,
  description: '',
  state: 'open',
  dueOn: null,
  epics,
})

const plan: Plan = {
  generatedAt: '2026-11-09T12:00:00Z',
  milestones: [
    // Older activity: finished a month ago
    mission(1, 'Older mission', [
      epic(10, [issue(11, { state: 'done', closedAt: '2026-10-01T15:00:00Z' }), issue(12)]),
    ]),
    // Latest activity: finished this week
    mission(2, 'Newest mission', [
      epic(20, [issue(21, { state: 'done', closedAt: '2026-11-07T15:00:00Z' }), issue(22)]),
    ]),
    // Nothing finished, nothing changed
    mission(3, 'Quiet mission', [epic(30, [issue(31)])]),
  ],
  unscheduled: [epic(40, [issue(41)])],
  hiddenCount: 4,
}

const renderTiles = (over: Partial<Plan> = {}) =>
  render(<PlanTiles plan={{ ...plan, ...over }} now={NOW} />)

describe('PlanTiles', () => {
  it('shows a tile for each mission, ordered by latest activity with the newest first', () => {
    renderTiles()
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['Newest mission', 'Older mission', 'Quiet mission'])
  })

  it('lays the tiles out two across on a phone and three across on a desktop, all the same size', () => {
    renderTiles()
    const tiles = screen.getAllByRole('article')
    const grid = tiles[0].parentElement as HTMLElement
    expect(grid.className).toContain('grid-cols-2')
    expect(grid.className).toContain('lg:grid-cols-3')
    for (const tile of tiles) expect(tile.className).not.toContain('col-span')
  })

  it('opens the mission’s own page from its tile', () => {
    renderTiles()
    expect(screen.getByRole('link', { name: 'Newest mission' }).getAttribute('href')).toBe(
      '/roadmap/missions/2',
    )
  })

  it('says how many are done, with a named bar', () => {
    renderTiles()
    expect(
      screen
        .getByRole('progressbar', { name: 'Newest mission: 1 of 2 done' })
        .getAttribute('value'),
    ).toBe('1')
  })

  it('draws every tile’s activity on one scale, named with its values', () => {
    renderTiles()
    const labels = screen.getAllByRole('img').map((svg) => svg.getAttribute('aria-label'))
    expect(labels).toHaveLength(3)
    expect(labels.every((label) => label?.startsWith('Finished each year, oldest first:'))).toBe(
      true,
    )
  })

  it('writes the news in words on each tile', () => {
    renderTiles()
    expect(screen.getAllByText('1 finished this year')).toHaveLength(2)
    expect(screen.getByText('Nothing finished yet')).toBeTruthy()
  })

  it('uses no insider words', () => {
    const { container } = renderTiles()
    expect(container.textContent).not.toMatch(/milestone|epic/i)
  })

  it('puts projects with no mission in their own group after the tiles', () => {
    renderTiles()
    const heading = screen.getByRole('heading', { name: 'Projects not yet in a mission' })
    expect(
      screen.getByText('Quiet mission').compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const group = heading.closest('section') as HTMLElement
    expect(within(group).getByText('Issue 40')).toBeTruthy()
  })

  it('offers a clearly tappable way to tell us something is missing', () => {
    renderTiles()
    const link = screen.getByRole('link', { name: 'Tell us' })
    expect(link.getAttribute('href')).toBe('/contact')
    expect(link.className).toContain('min-h-11')
  })

  it('says how many issues are not shown, and leaves the note out when there are none', () => {
    const { rerender } = renderTiles()
    expect(screen.getByText(/4 issues aren’t shown/)).toBeTruthy()
    rerender(<PlanTiles plan={{ ...plan, hiddenCount: 1 }} now={NOW} />)
    expect(screen.getByText(/1 issue isn’t shown/)).toBeTruthy()
    rerender(<PlanTiles plan={{ ...plan, hiddenCount: 0 }} now={NOW} />)
    expect(screen.queryByText(/shown/)).toBeNull()
  })

  it('has an empty state when the plan has nothing', () => {
    renderTiles({ milestones: [], unscheduled: [] })
    expect(screen.getByText(/can’t show the plan/i)).toBeTruthy()
  })

  it('is accessible', async () => {
    const { container } = renderTiles()
    await expectAccessible(container)
  })
})
