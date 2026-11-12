import { describe, expect, it } from 'vitest'

import { ACTIVITY, bucketCounts, pickActivityStep, planActivity } from './activity'
import type { PlanEpic, PlanIssue, PlanMilestone } from './types'

const NOW = new Date('2026-11-09T12:00:00Z')
const DAY = 86_400_000
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()
/** `n` closing times, all `days` ago, so a bucket can be made busy or quiet */
const closedTimes = (n: number, days: number) => Array.from({ length: n }, () => daysAgo(days))

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
const done = (number: number, closedAt: string) => issue(number, { state: 'done', closedAt })

const epic = (number: number, children: PlanIssue[]): PlanEpic => ({
  ...issue(number),
  children,
})
const milestone = (number: number, children: PlanIssue[]): PlanMilestone => ({
  number,
  title: `Mission ${number}`,
  description: '',
  state: 'open',
  dueOn: null,
  epics: [epic(number * 100, children)],
})

describe('bucketCounts', () => {
  it('counts weeks as rolling 7-day blocks, oldest first, newest last', () => {
    const counts = bucketCounts(
      [daysAgo(0.5), daysAgo(6.9), daysAgo(7.5), daysAgo(20), daysAgo(55)],
      'week',
      NOW,
    )
    expect(counts).toHaveLength(ACTIVITY.points.week)
    expect(counts.at(-1)).toBe(2) // this week
    expect(counts.at(-2)).toBe(1) // last week
    expect(counts.at(-3)).toBe(1) // 14 to 21 days ago
    expect(counts[0]).toBe(1) // the oldest block still in the window
  })

  it('leaves out work older than the window and work dated in the future', () => {
    const counts = bucketCounts([daysAgo(57), daysAgo(400), daysAgo(-3)], 'week', NOW)
    expect(counts.every((c) => c === 0)).toBe(true)
  })

  it('counts months as calendar months in the site timezone', () => {
    const counts = bucketCounts(
      [
        '2026-11-02T15:00:00Z',
        '2026-10-15T15:00:00Z',
        '2026-06-20T15:00:00Z',
        '2026-05-20T15:00:00Z',
      ],
      'month',
      NOW,
    )
    expect(counts).toHaveLength(ACTIVITY.points.month)
    expect(counts.at(-1)).toBe(1) // November
    expect(counts.at(-2)).toBe(1) // October
    expect(counts[0]).toBe(1) // June, the oldest month in the window; May is out
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('puts a late-evening close on the site-local month, not the UTC one', () => {
    const december = new Date('2026-12-15T12:00:00Z')
    // 03:00 UTC on 1 December is the evening of 30 November in Central time
    const counts = bucketCounts(['2026-12-01T03:00:00Z'], 'month', december)
    expect(counts.at(-1)).toBe(0)
    expect(counts.at(-2)).toBe(1)
  })

  it('counts years as calendar years', () => {
    const counts = bucketCounts(
      ['2026-03-01T12:00:00Z', '2025-03-01T12:00:00Z', '2023-03-01T12:00:00Z'],
      'year',
      NOW,
    )
    expect(counts).toHaveLength(ACTIVITY.points.year)
    expect(counts).toEqual([0, 1, 1]) // 2024, 2025, 2026; 2023 is out
  })
})

describe('pickActivityStep', () => {
  const busy = ACTIVITY.busyMin

  it('picks weeks when at least half of the weeks in the window are busy', () => {
    const times = [0, 1, 2, 3].flatMap((w) => closedTimes(busy, w * 7 + 3))
    expect(pickActivityStep(times, NOW)).toBe('week')
  })

  it('does not call a week busy until it reaches the busy count', () => {
    const times = [0, 1, 2, 3].flatMap((w) => closedTimes(busy - 1, w * 7 + 3))
    expect(pickActivityStep(times, NOW)).not.toBe('week')
  })

  it('switches to months when fewer than half of the weeks are busy but the months are', () => {
    const weeks = [0, 1, 2].flatMap((w) => closedTimes(busy, w * 7 + 3)) // 3 busy weeks of 8
    const months = ['2026-08-10', '2026-07-10', '2026-06-10'].flatMap((d) =>
      Array.from({ length: busy }, () => `${d}T15:00:00Z`),
    )
    expect(pickActivityStep([...weeks, ...months], NOW)).toBe('month')
  })

  it('switches to years when the months are sparse too', () => {
    const times = [
      '2026-10-10T15:00:00Z',
      '2026-07-10T15:00:00Z',
      '2025-05-10T15:00:00Z',
      '2025-02-10T15:00:00Z',
    ]
    expect(pickActivityStep(times, NOW)).toBe('year')
  })

  it('stays on weeks when there is no activity at all', () => {
    expect(pickActivityStep([], NOW)).toBe('week')
  })
})

describe('planActivity', () => {
  it('orders missions by their latest close, most recent first', () => {
    const result = planActivity(
      [
        milestone(1, [done(11, daysAgo(10))]),
        milestone(2, [done(21, daysAgo(1))]),
        milestone(3, [done(31, daysAgo(4)), done(32, daysAgo(30))]),
      ],
      NOW,
    )
    expect(result.missions.map((m) => m.milestoneNumber)).toEqual([2, 3, 1])
    expect(result.missions[0].latestAt).toBe(daysAgo(1))
  })

  it('puts missions with no finished work last, in milestone order, and keeps ties stable', () => {
    const same = daysAgo(2)
    const result = planActivity(
      [
        milestone(5, [issue(51)]),
        milestone(4, [done(41, same)]),
        milestone(3, [done(31, same)]),
        milestone(2, [issue(21, { state: 'not-planned', closedAt: daysAgo(1) })]),
      ],
      NOW,
    )
    expect(result.missions.map((m) => m.milestoneNumber)).toEqual([3, 4, 2, 5])
    expect(result.missions.at(-1)?.latestAt).toBeNull()
  })

  it('gives every mission a series of the same length on one shared maximum', () => {
    const result = planActivity(
      [
        milestone(
          1,
          [1, 2, 3, 8, 9, 10, 15, 16, 17, 22, 23, 24].map((days) => done(10 + days, daysAgo(days))),
        ),
        milestone(2, [done(21, daysAgo(9))]),
      ],
      NOW,
    )
    expect(result.step).toBe('week')
    expect(result.stepLabel).toBe('weeks')
    expect(result.missions.every((m) => m.series.length === ACTIVITY.points.week)).toBe(true)
    expect(result.max).toBe(3)
  })

  it('uses one step for every mission, chosen from the whole plan', () => {
    const result = planActivity(
      [
        milestone(1, [done(11, '2026-10-10T15:00:00Z')]),
        milestone(2, [done(21, '2025-05-10T15:00:00Z')]),
      ],
      NOW,
    )
    expect(result.step).toBe('year')
    expect(result.stepLabel).toBe('years')
    expect(result.missions[0].series).toHaveLength(ACTIVITY.points.year)
    expect(result.missions[1].series).toHaveLength(ACTIVITY.points.year)
  })

  it('returns a maximum of at least 1 so an empty plan never divides by zero', () => {
    expect(planActivity([], NOW)).toMatchObject({ step: 'week', max: 1, missions: [] })
  })
})
