// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { Plan, PlanEpic, PlanIssue, PlanMilestone } from '../domain/types'
import { PlanFilterProvider } from './PlanFilterProvider'
import { PlanSummary } from './PlanSummary'
import { PlanTiles } from './PlanTiles'

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
const finished = (number: number, closedAt: string) => issue(number, { state: 'done', closedAt })
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
  generatedAt: NOW.toISOString(),
  hiddenCount: 0,
  milestones: [
    mission(1, 'Events', [
      epic(10, [finished(100, '2026-11-12T18:00:00Z'), finished(101, '2026-11-13T18:00:00Z')]),
    ]),
    mission(2, 'News', [epic(20, [finished(200, '2026-11-05T18:00:00Z')])]),
  ],
  unscheduled: [],
}

function renderPage() {
  return render(
    <PlanFilterProvider plan={plan}>
      <PlanSummary plan={plan} now={NOW} />
      <PlanTiles plan={plan} now={NOW} />
    </PlanFilterProvider>,
  )
}

const map = () => screen.getByRole('group', { name: /^Activity over four weeks/ })
const pressDay = (name: string) => fireEvent.click(within(map()).getByRole('button', { name }))
const blocks = (container: HTMLElement) =>
  container.querySelector('[data-plan-layout="blocks"]') as HTMLElement
const missionNames = (container: HTMLElement) =>
  within(blocks(container))
    .queryAllByRole('article')
    .map((article) => article.querySelector('h3')?.textContent)
const chips = () => screen.queryAllByRole('button', { name: /^Remove / })

describe('the plan page day filter', () => {
  it('loads with nothing chosen: every mission, no pill, no status line', () => {
    const { container } = renderPage()
    expect(missionNames(container)).toEqual(['Events', 'News'])
    expect(chips()).toHaveLength(0)
    expect(screen.queryByRole('status')?.textContent ?? '').toBe('')
    expect(
      within(map())
        .getAllByRole('button')
        .every((button) => button.getAttribute('aria-pressed') === 'false'),
    ).toBe(true)
  })

  it('narrows the missions to the chosen day, adds a pill with its counts and says what shows', () => {
    const { container } = renderPage()
    pressDay('Thu, Nov 12: 1')
    expect(missionNames(container)).toEqual(['Events'])
    const pill = screen.getByRole('button', { name: 'Remove Thu, Nov 12: 1 finished, 0 opened' })
    expect(pill.textContent).toContain('Nov 12')
    expect(screen.getByRole('status').textContent).toBe(
      'Showing 1 issue opened or finished on Thu, Nov 12.',
    )
  })

  it('adds a day to the choice, and takes it out by pressing it again or by its pill', () => {
    const { container } = renderPage()
    pressDay('Thu, Nov 12: 1')
    pressDay('Fri, Nov 13: 1')
    expect(chips()).toHaveLength(2)
    expect(screen.getByRole('status').textContent).toContain('2 issues')
    pressDay('Fri, Nov 13: 1')
    expect(chips()).toHaveLength(1)
    fireEvent.click(chips()[0])
    expect(chips()).toHaveLength(0)
    expect(missionNames(container)).toEqual(['Events', 'News'])
  })

  it('says so, with a way back, when no issue was opened or finished on the chosen days', () => {
    renderPage()
    pressDay('Wed, Nov 11: 0')
    expect(screen.getByText('Nothing was opened or finished then')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show everything' }))
    expect(chips()).toHaveLength(0)
  })

  it('locks a mission’s week under a single chosen day: that day fixed, the others unavailable', () => {
    const { container } = renderPage()
    pressDay('Thu, Nov 12: 1')
    const week = within(blocks(container)).getByRole('group', {
      name: /^Events, finished each day/,
    })
    const buttons = within(week).getAllByRole('button')
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
  })

  it('lets a mission pick only among two chosen days, the others unavailable', () => {
    const { container } = renderPage()
    pressDay('Thu, Nov 12: 1')
    pressDay('Fri, Nov 13: 1')
    const week = within(blocks(container)).getByRole('group', {
      name: /^Events, finished each day/,
    })
    const buttons = within(week).getAllByRole('button')
    expect(buttons.filter((button) => !(button as HTMLButtonElement).disabled)).toHaveLength(2)
    expect(
      within(week).getByRole('button', {
        name: 'Mon, Nov 9: 0, not available, not selected above',
      }),
    ).toBeTruthy()
    fireEvent.click(within(week).getByRole('button', { name: 'Fri, Nov 13: 1' }))
    expect(
      within(week).getByRole('button', { name: 'Fri, Nov 13: 1' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('fixes a project’s week to the one day its mission picked, not to every day on top', () => {
    const { container } = renderPage()
    pressDay('Thu, Nov 12: 1')
    pressDay('Fri, Nov 13: 1')
    const phone = container.querySelector('[data-plan-layout="accordions"]') as HTMLElement
    const strip = (name: RegExp) => within(phone).getByRole('group', { name })
    fireEvent.click(
      within(strip(/^Events, finished each day/)).getByRole('button', { name: 'Fri, Nov 13: 1' }),
    )
    const pressed = within(strip(/^Issue 10, finished each day/))
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((button) => button.getAttribute('aria-label'))).toEqual(['Fri, Nov 13: 1'])
  })

  it('drops a mission’s pick when its day leaves the top', () => {
    const { container } = renderPage()
    pressDay('Thu, Nov 12: 1')
    pressDay('Fri, Nov 13: 1')
    const week = () =>
      within(blocks(container)).getByRole('group', { name: /^Events, finished each day/ })
    fireEvent.click(within(week()).getByRole('button', { name: 'Fri, Nov 13: 1' }))
    pressDay('Fri, Nov 13: 1')
    pressDay('Wed, Nov 11: 0')
    expect(
      within(week())
        .getAllByRole('button')
        .filter((button) => button.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(0)
  })

  it('passes an accessibility check with days chosen', async () => {
    const { container } = renderPage()
    pressDay('Thu, Nov 12: 1')
    pressDay('Fri, Nov 13: 1')
    await expectAccessible(container)
  })
})
