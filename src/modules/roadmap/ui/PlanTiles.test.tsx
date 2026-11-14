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
  createdAt: null,
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

const layout = (container: HTMLElement, name: 'blocks' | 'accordions') =>
  container.querySelector(`[data-plan-layout="${name}"]`) as HTMLElement

describe('PlanTiles', () => {
  it('shows a block for each mission, ordered by latest activity with the newest first', () => {
    const { container } = renderTiles()
    const names = within(layout(container, 'blocks'))
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(names).toEqual(['Newest mission', 'Older mission', 'Quiet mission'])
  })

  it('lays the blocks out two across on a tablet and three on a desktop, all the same size, and hides them on a phone', () => {
    const { container } = renderTiles()
    const grid = layout(container, 'blocks')
    expect(grid.className).toContain('hidden')
    expect(grid.className).toContain('md:grid-cols-2')
    expect(grid.className).toContain('lg:grid-cols-3')
    for (const block of within(grid).getAllByRole('article')) {
      expect(block.className).not.toContain('col-span')
    }
  })

  it('shows the same missions as accordions on a phone only, all closed, in the same order', () => {
    const { container } = renderTiles()
    const list = layout(container, 'accordions')
    expect(list.className).toContain('md:hidden')
    const boxes = [...list.querySelectorAll(':scope > details')] as HTMLDetailsElement[]
    expect(boxes.map((box) => box.open)).toEqual([false, false, false])
    expect(boxes.map((box) => box.querySelector('summary')?.textContent)).toEqual([
      expect.stringContaining('Newest mission'),
      expect.stringContaining('Older mission'),
      expect.stringContaining('Quiet mission'),
    ])
  })

  it('opens the mission’s own page from its block and from its accordion', () => {
    const { container } = renderTiles()
    const block = within(layout(container, 'blocks')).getByRole('link', { name: 'Newest mission' })
    expect(block.getAttribute('href')).toBe('/roadmap/missions/2')
    const open = within(layout(container, 'accordions')).getAllByRole('link', {
      name: /Open this mission/,
    })
    expect(open.map((link) => link.getAttribute('href'))).toContain('/roadmap/missions/2')
  })

  it('says how many are done, small, on each block', () => {
    const { container } = renderTiles()
    const block = within(layout(container, 'blocks')).getAllByRole('article')[0]
    expect(block.textContent).toMatch(/1\s*of 2\s*done/)
  })

  it('draws each mission’s week as a heat map named with its values', () => {
    const { container } = renderTiles()
    const labels = within(layout(container, 'blocks'))
      .getAllByRole('img')
      .map((img) => img.getAttribute('aria-label'))
    expect(labels).toHaveLength(3)
    expect(labels[0]).toBe('Newest mission, finished each day this week: 0, 0, 0, 0, 1, 0, 0')
  })

  it('marks a mission with nothing finished this week as quiet by shape and in words', () => {
    const { container } = renderTiles()
    const blocks = within(layout(container, 'blocks')).getAllByRole('article')
    expect(within(blocks[0]).getByText('Finished something this week')).toBeTruthy()
    expect(within(blocks[1]).getByText('Quiet this week')).toBeTruthy()
    expect(within(blocks[2]).getByText('Quiet this week')).toBeTruthy()
    const mark = (block: HTMLElement) => block.querySelector('svg')?.getAttribute('class')
    expect(mark(blocks[0])).not.toBe(mark(blocks[1]))
  })

  it('opens a phone accordion to its week and its projects, each closed and opening to its own week and issues', () => {
    const { container } = renderTiles()
    const box = layout(container, 'accordions').querySelector('details') as HTMLDetailsElement
    const projects = [...box.querySelectorAll('details')]
    expect(projects).toHaveLength(1)
    expect(projects[0].open).toBe(false)
    expect(within(box).getAllByRole('img').length).toBe(2)
    expect(within(projects[0]).getByText('Issue 21')).toBeTruthy()
    expect(within(projects[0]).getByText(/Closed/)).toBeTruthy()
  })

  it('uses no insider words', () => {
    const { container } = renderTiles()
    expect(container.textContent).not.toMatch(/milestone|epic/i)
  })

  it('puts projects with no mission in their own group after the tiles', () => {
    renderTiles()
    const heading = screen.getByRole('heading', { name: 'Projects not yet in a mission' })
    expect(
      screen.getAllByText('Quiet mission')[0].compareDocumentPosition(heading) &
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
