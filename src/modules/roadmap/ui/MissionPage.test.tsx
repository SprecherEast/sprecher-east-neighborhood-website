// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { PlanEpic, PlanIssue, PlanMilestone } from '../domain/types'
import { MissionPage } from './MissionPage'

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

const epic = (number: number, title: string, children: PlanIssue[]): PlanEpic => ({
  ...issue(number, { title, labels: ['epic'] }),
  children,
})

const mission: PlanMilestone = {
  number: 5,
  title: 'Property tax pages',
  description: '',
  state: 'open',
  dueOn: null,
  epics: [
    epic(10, 'Fact tabs', [
      issue(11, {
        title: 'feat: Tabs for every post',
        state: 'done',
        closedAt: '2026-11-07T15:00:00Z',
      }),
      issue(12),
    ]),
    epic(20, 'Charts', []),
  ],
}

type Activity = Parameters<typeof MissionPage>[0]['activity']
const activity: Activity = { series: [0, 1, 0, 2, 0, 0, 1, 3], max: 4, stepLabel: 'weeks' }

const renderPage = (over: Partial<Activity> = {}) =>
  render(<MissionPage mission={mission} activity={{ ...activity, ...over }} now={NOW} />)

describe('MissionPage', () => {
  it('starts every project box closed', () => {
    const { container } = renderPage()
    const boxes = [...container.querySelectorAll('details')]
    expect(boxes).toHaveLength(2)
    expect(boxes.map((box) => box.open)).toEqual([false, false])
  })

  it('says how much of the mission is done, in words and in a named bar', () => {
    renderPage()
    expect(
      screen.getByRole('progressbar', { name: 'Property tax pages: 1 of 2 done' }),
    ).toBeTruthy()
    expect(document.body.textContent).toMatch(/1\s*of 2\s*done/)
  })

  it('draws the activity line with every value in its name, and writes the numbers beside it', () => {
    renderPage()
    expect(
      screen.getByRole('img', { name: 'Finished each week, oldest first: 0, 1, 0, 2, 0, 0, 1, 3' }),
    ).toBeTruthy()
    expect(screen.getByText(/Last 8 weeks: 0, 1, 0, 2, 0, 0, 1, 3/)).toBeTruthy()
    expect(screen.getByText(/3 finished this week/)).toBeTruthy()
  })

  it('says it is quiet when the newest step has nothing, and when nothing is finished at all', () => {
    renderPage({ series: [2, 0] })
    expect(screen.getByText(/Quiet this week/)).toBeTruthy()
    cleanup()
    render(
      <MissionPage
        mission={{ ...mission, epics: [epic(30, 'Only open', [issue(31)])] }}
        activity={{ ...activity, series: [0, 0] }}
        now={NOW}
      />,
    )
    expect(screen.getByText(/Nothing finished yet/)).toBeTruthy()
  })

  it('names the step in the sentence, so months read as months', () => {
    renderPage({ series: [1, 4], stepLabel: 'months' })
    expect(screen.getByText(/Last 2 months: 1, 4/)).toBeTruthy()
    expect(screen.getByText(/4 finished this month/)).toBeTruthy()
  })

  it('lists each project as a box that opens, with its issues linked and the type prefix dropped', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('details')).toHaveLength(2)
    const link = screen.getByRole('link', { name: /Tabs for every post/ })
    expect(link.textContent).toContain('Tabs for every post')
    expect(link.textContent).not.toContain('feat:')
    expect(link.getAttribute('href')).toBe('/roadmap/11')
  })

  it('puts each issue’s state on the title line, with the number and close date below', () => {
    renderPage()
    const row = screen
      .getByRole('link', { name: /Tabs for every post/ })
      .closest('li') as HTMLElement
    expect(within(row).getByText('Done')).toBeTruthy()
    expect(row.textContent).toMatch(/#11 · Closed/)
    const titleLine = within(row).getByText('Done').closest('div')
    expect(titleLine?.contains(screen.getByRole('link', { name: /Tabs for every post/ }))).toBe(
      true,
    )
  })

  it('says a project with no issues has none yet', () => {
    renderPage()
    expect(screen.getByText('No issues to show under this project yet.')).toBeTruthy()
  })

  it('is accessible', async () => {
    const { container } = renderPage()
    await expectAccessible(container)
  })
})
