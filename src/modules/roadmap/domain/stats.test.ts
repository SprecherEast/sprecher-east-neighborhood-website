import { describe, expect, it } from 'vitest'

import { dueIn, issueProgress, planStats, RECENT_DAYS } from './stats'
import type { Plan, PlanEpic, PlanIssue } from './types'

const NOW = new Date('2026-11-09T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const issue = (number: number, over: Partial<PlanIssue> = {}): PlanIssue => ({
  number,
  title: `Issue ${number}`,
  state: 'open',
  labels: [],
  description: '',
  url: '',
  closedAt: null,
  ...over,
})

const epic = (number: number, state: PlanIssue['state'], children: PlanIssue[]): PlanEpic => ({
  ...issue(number, { state }),
  children,
})

const plan = (over: Partial<Plan> = {}): Plan => ({
  generatedAt: NOW.toISOString(),
  milestones: [],
  unscheduled: [],
  hiddenCount: 0,
  ...over,
})

describe('planStats', () => {
  it('counts open and done issues across every milestone and the unscheduled group', () => {
    const stats = planStats(
      plan({
        milestones: [
          {
            number: 1,
            title: 'M',
            description: '',
            state: 'open',
            dueOn: null,
            epics: [
              epic(10, 'open', [
                issue(11),
                issue(12, { state: 'done', closedAt: daysAgo(40) }),
                issue(13, { state: 'not-planned', closedAt: daysAgo(1) }),
              ]),
            ],
          },
        ],
        unscheduled: [
          epic(20, 'done', [issue(21), issue(22, { state: 'done', closedAt: daysAgo(2) })]),
        ],
      }),
      NOW,
    )

    expect(stats.open).toBe(2)
    expect(stats.done).toBe(2)
    expect(stats.milestones).toBe(1)
    expect(stats.epics).toBe(2)
    expect(stats.epicsDone).toBe(1)
  })

  it('counts what was finished in the last 7 days, and in the last 30', () => {
    const stats = planStats(
      plan({
        unscheduled: [
          epic(20, 'open', [
            issue(21, { state: 'done', closedAt: daysAgo(1) }),
            issue(22, { state: 'done', closedAt: daysAgo(RECENT_DAYS.week) }),
            issue(23, { state: 'done', closedAt: daysAgo(10) }),
            issue(24, { state: 'done', closedAt: daysAgo(31) }),
            issue(25, { state: 'done', closedAt: null }),
          ]),
        ],
      }),
      NOW,
    )

    expect(stats.doneThisWeek).toBe(2)
    expect(stats.doneThisMonth).toBe(3)
  })

  it('has zeros for an empty plan', () => {
    expect(planStats(plan(), NOW)).toEqual({
      open: 0,
      done: 0,
      doneThisWeek: 0,
      doneThisMonth: 0,
      milestones: 0,
      epics: 0,
      epicsDone: 0,
    })
  })
})

describe('issueProgress', () => {
  it('counts done and open, leaves out ones not planned, and rounds the percent', () => {
    const progress = issueProgress(
      [
        issue(1, { state: 'done', closedAt: daysAgo(2) }),
        issue(2, { state: 'done', closedAt: daysAgo(20) }),
        issue(3),
        issue(4, { state: 'not-planned' }),
      ],
      NOW,
    )
    expect(progress).toEqual({ done: 2, open: 1, total: 3, percent: 67, doneThisWeek: 1 })
  })

  it('is empty, at 0 percent, with nothing to count', () => {
    expect(issueProgress([], NOW)).toEqual({
      done: 0,
      open: 0,
      total: 0,
      percent: 0,
      doneThisWeek: 0,
    })
  })
})

describe('dueIn', () => {
  // 2026-11-09 06:00 in Chicago is already the 9th, though it is 12:00 UTC
  it('counts whole days from today in the site timezone, never from the clock time', () => {
    expect(dueIn('2026-11-09T00:00:00.000Z', NOW)).toBe(0)
    expect(dueIn('2026-11-10T00:00:00.000Z', NOW)).toBe(1)
    expect(dueIn('2026-12-01T00:00:00.000Z', NOW)).toBe(22)
    expect(dueIn('2026-11-06T00:00:00.000Z', NOW)).toBe(-3)
  })

  it('still reads the 9th late on the evening of the 9th, when UTC is already the 10th', () => {
    expect(dueIn('2026-11-09T00:00:00.000Z', new Date('2026-11-10T03:00:00Z'))).toBe(0)
  })
})
