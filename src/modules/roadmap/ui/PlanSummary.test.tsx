// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import type { PlanStats } from '../domain/stats'
import { PlanSummary } from './PlanSummary'

afterEach(cleanup)

const stats: PlanStats = {
  open: 12,
  done: 30,
  doneThisWeek: 5,
  doneThisMonth: 14,
  milestones: 4,
  epics: 9,
  epicsDone: 2,
}

const generatedAt = '2026-11-09T18:00:00Z'

describe('PlanSummary', () => {
  it('shows each number with its name', () => {
    render(<PlanSummary stats={stats} generatedAt={generatedAt} />)
    const value = (name: string) =>
      within(screen.getByText(name).closest('dt')?.parentElement as HTMLElement).getByText(/^\d+$/)
        .textContent

    expect(value('Open')).toBe('12')
    expect(value('Done')).toBe('30')
    expect(value('Done this week')).toBe('5')
    expect(value('Done this month')).toBe('14')
  })

  it('says how much of the plan there is and when it was last read', () => {
    render(<PlanSummary stats={stats} generatedAt={generatedAt} />)
    expect(screen.getByText(/4 milestones · 9 epics, 2 done/)).toBeTruthy()
    expect(screen.getByText(/Updated/)).toBeTruthy()
  })

  it('uses singular words for one', () => {
    render(
      <PlanSummary
        stats={{ ...stats, milestones: 1, epics: 1, epicsDone: 0 }}
        generatedAt={generatedAt}
      />,
    )
    expect(screen.getByText(/1 milestone · 1 epic, 0 done/)).toBeTruthy()
  })

  it('is accessible', async () => {
    const { container } = render(<PlanSummary stats={stats} generatedAt={generatedAt} />)
    await expectAccessible(container)
  })
})
