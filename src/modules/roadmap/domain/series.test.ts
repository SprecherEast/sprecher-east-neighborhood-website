import { describe, expect, it } from 'vitest'

import { groupSeries, lastDays, planSeries, weekActivity } from './series'
import type { Plan, PlanIssue } from './types'

// Fri 2026-11-13, 23:30 in Chicago (UTC-6): already Saturday in UTC
const NOW = new Date('2026-11-14T05:30:00Z')

const issue = (number: number, over: Partial<PlanIssue> = {}): PlanIssue => ({
  number,
  title: `Issue ${number}`,
  state: 'open',
  labels: [],
  description: '',
  url: '',
  createdAt: '2026-11-01T18:00:00Z',
  closedAt: null,
  updatedAt: null,
  ...over,
})

const done = (number: number, closedAt: string, over: Partial<PlanIssue> = {}) =>
  issue(number, { state: 'done', closedAt, ...over })

describe('lastDays', () => {
  it('ends on today in the site calendar, oldest first, however late it is in UTC', () => {
    expect(lastDays(NOW, 3)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13'])
  })

  it('crosses a month and a daylight-saving change without skipping or repeating a day', () => {
    const days = lastDays(new Date('2026-11-02T18:00:00Z'), 5)
    expect(days).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
})

describe('groupSeries', () => {
  it('counts finished issues on the site calendar day they closed', () => {
    const series = groupSeries(
      [
        done(1, '2026-11-14T03:00:00Z'), // Fri evening in Chicago
        done(2, '2026-11-13T15:00:00Z'),
        done(3, '2026-11-12T20:00:00Z'),
      ],
      NOW,
      3,
    )
    expect(series.days).toEqual(['2026-11-11', '2026-11-12', '2026-11-13'])
    expect(series.finished).toEqual([0, 1, 2])
  })

  it('shows a quiet day as zero, not a gap', () => {
    expect(groupSeries([done(1, '2026-11-13T15:00:00Z')], NOW, 4).finished).toEqual([0, 0, 0, 1])
  })

  it('keeps the running total, including issues finished before the window', () => {
    const series = groupSeries(
      [done(1, '2026-10-01T15:00:00Z'), done(2, '2026-11-12T15:00:00Z')],
      NOW,
      3,
    )
    expect(series.doneTotal).toEqual([1, 2, 2])
  })

  it('counts how many were open at the end of each day', () => {
    const series = groupSeries(
      [
        issue(1, { createdAt: '2026-11-01T12:00:00Z' }), // open throughout
        done(2, '2026-11-12T15:00:00Z', { createdAt: '2026-11-01T12:00:00Z' }), // open until it closes
        issue(3, { createdAt: '2026-11-13T15:00:00Z' }), // opened on the last day
      ],
      NOW,
      3,
    )
    expect(series.open).toEqual([2, 1, 2])
  })

  it('counts an issue opened and finished on the same day as never open at the end of it', () => {
    const series = groupSeries(
      [done(1, '2026-11-12T18:00:00Z', { createdAt: '2026-11-12T14:00:00Z' })],
      NOW,
      3,
    )
    expect(series.open).toEqual([0, 0, 0])
    expect(series.finished).toEqual([0, 1, 0])
  })

  it('treats an issue with no open date as open from before the window', () => {
    expect(groupSeries([issue(1, { createdAt: null })], NOW, 2).open).toEqual([1, 1])
  })

  it('leaves out issues decided against, in every series', () => {
    const series = groupSeries(
      [issue(1, { state: 'not-planned', closedAt: '2026-11-13T15:00:00Z' })],
      NOW,
      2,
    )
    expect(series).toMatchObject({ finished: [0, 0], doneTotal: [0, 0], open: [0, 0] })
  })

  it('gives all zeros for no issues', () => {
    expect(groupSeries([], NOW, 3)).toEqual({
      days: ['2026-11-11', '2026-11-12', '2026-11-13'],
      finished: [0, 0, 0],
      doneTotal: [0, 0, 0],
      open: [0, 0, 0],
    })
  })
})

describe('planSeries', () => {
  it('reads every project of every mission and the ones in no mission, children only', () => {
    const child = (n: number) => done(n, '2026-11-13T15:00:00Z')
    const epic = (n: number, children: PlanIssue[]) => ({ ...issue(n), children })
    const plan: Plan = {
      generatedAt: NOW.toISOString(),
      milestones: [
        {
          number: 1,
          title: 'M',
          description: '',
          state: 'open',
          dueOn: null,
          epics: [epic(10, [child(11)])],
        },
      ],
      unscheduled: [epic(20, [child(21), child(22)])],
      hiddenCount: 0,
    }
    expect(planSeries(plan, NOW, 2).finished).toEqual([0, 3])
  })
})

describe('weekActivity', () => {
  it('gives the last seven days of finished work and says it is quiet when there is none', () => {
    const busy = weekActivity(
      [done(1, '2026-11-13T15:00:00Z'), done(2, '2026-11-08T15:00:00Z')],
      NOW,
    )
    expect(busy.days).toHaveLength(7)
    expect(busy.days.at(-1)).toBe('2026-11-13')
    expect(busy.finished).toEqual([0, 1, 0, 0, 0, 0, 1])
    expect(busy.quiet).toBe(false)

    const quiet = weekActivity([done(3, '2026-11-01T15:00:00Z'), issue(4)], NOW)
    expect(quiet.finished).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(quiet.quiet).toBe(true)
  })

  it('counts only the seven days, today included', () => {
    expect(weekActivity([done(1, '2026-11-06T15:00:00Z')], NOW).quiet).toBe(true)
    expect(weekActivity([done(1, '2026-11-07T15:00:00Z')], NOW).quiet).toBe(false)
  })
})
