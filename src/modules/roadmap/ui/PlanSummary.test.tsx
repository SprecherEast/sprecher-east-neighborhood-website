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
  it('shows the three numbers with their names', () => {
    render(<PlanSummary stats={stats} generatedAt={generatedAt} />)
    const value = (name: string) =>
      within(screen.getByText(name).closest('dt')?.parentElement as HTMLElement).getByText(/^\d+$/)
        .textContent
    expect(value('Finished this week')).toBe('5')
    expect(value('Done in all')).toBe('30')
    expect(value('Still open')).toBe('12')
  })

  it('says where the numbers come from and when they were last read, without insider words', () => {
    const { container } = render(<PlanSummary stats={stats} generatedAt={generatedAt} />)
    expect(screen.getByText(/Straight from our working plan\. Updated/)).toBeTruthy()
    expect(container.textContent).not.toMatch(/milestone|epic/i)
  })

  it('is accessible', async () => {
    const { container } = render(<PlanSummary stats={stats} generatedAt={generatedAt} />)
    await expectAccessible(container)
  })
})
