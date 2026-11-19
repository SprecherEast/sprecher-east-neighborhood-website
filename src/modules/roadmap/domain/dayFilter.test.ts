import { describe, expect, it } from 'vitest'

import {
  activityByDay,
  effectiveDays,
  epicScope,
  matchesDays,
  missionScope,
  settleChoices,
  stripEnabled,
} from './dayFilter'
import type { PlanIssue } from './types'

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

describe('matchesDays', () => {
  it('matches everything when no day is chosen', () => {
    expect(matchesDays(issue(1), [])).toBe(true)
  })

  it('matches an issue created on a chosen day, on the site calendar', () => {
    // 2026-11-14 03:00 UTC is still Friday 13 in Chicago
    const created = issue(1, { createdAt: '2026-11-14T03:00:00Z' })
    expect(matchesDays(created, ['2026-11-13'])).toBe(true)
    expect(matchesDays(created, ['2026-11-14'])).toBe(false)
  })

  it('matches an issue finished on a chosen day', () => {
    const finished = issue(2, { state: 'done', closedAt: '2026-11-12T20:00:00Z' })
    expect(matchesDays(finished, ['2026-11-12'])).toBe(true)
  })

  it('matches on any of several days', () => {
    const finished = issue(2, { state: 'done', closedAt: '2026-11-12T20:00:00Z' })
    expect(matchesDays(finished, ['2026-11-10', '2026-11-12'])).toBe(true)
  })

  it('never matches an issue decided against, and ignores a close date on an open one', () => {
    const no = issue(3, { state: 'not-planned', createdAt: '2026-11-12T18:00:00Z' })
    expect(matchesDays(no, ['2026-11-12'])).toBe(false)
    const open = issue(4, { closedAt: '2026-11-12T18:00:00Z' })
    expect(matchesDays(open, ['2026-11-12'])).toBe(false)
  })
})

describe('activityByDay', () => {
  it('counts what was finished and what was opened on each day, leaving quiet days out', () => {
    const issues = [
      issue(1, { createdAt: '2026-11-12T18:00:00Z' }),
      issue(2, {
        createdAt: '2026-11-12T19:00:00Z',
        state: 'done',
        closedAt: '2026-11-13T20:00:00Z',
      }),
      issue(3, { state: 'done', createdAt: null, closedAt: '2026-11-13T21:00:00Z' }),
      issue(4, { state: 'not-planned', createdAt: '2026-11-12T18:00:00Z' }),
    ]
    expect(activityByDay(issues)).toEqual({
      '2026-11-12': { finished: 0, opened: 2 },
      '2026-11-13': { finished: 2, opened: 0 },
    })
  })
})

describe('effectiveDays', () => {
  it('follows the level above when nothing is picked', () => {
    expect(effectiveDays(['2026-11-12', '2026-11-13'], [])).toEqual(['2026-11-12', '2026-11-13'])
  })

  it('narrows to the pick, within what the level above allows', () => {
    const top = ['2026-11-12', '2026-11-13']
    expect(effectiveDays(top, ['2026-11-13'])).toEqual(['2026-11-13'])
    expect(effectiveDays(top, ['2026-11-10'])).toEqual(top)
  })

  it('cannot widen a single day above', () => {
    expect(effectiveDays(['2026-11-13'], ['2026-11-12'])).toEqual(['2026-11-13'])
  })

  it('takes the pick when nothing is chosen above', () => {
    expect(effectiveDays([], ['2026-11-12'])).toEqual(['2026-11-12'])
  })
})

describe('stripEnabled', () => {
  const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']

  it('lets every day be pressed when nothing is chosen above', () => {
    expect(stripEnabled([], week)).toEqual(week)
  })

  it('lets nothing be pressed under a single day', () => {
    expect(stripEnabled(['2026-11-13'], week)).toEqual([])
  })

  it('lets only the chosen days that the strip shows be pressed', () => {
    expect(stripEnabled(['2026-11-12', '2026-11-13', '2026-10-01'], week)).toEqual([
      '2026-11-12',
      '2026-11-13',
    ])
  })
})

describe('settleChoices', () => {
  const parentOf = {
    [missionScope(1)]: null,
    [epicScope(10)]: missionScope(1),
    [epicScope(20)]: null,
  }

  it('drops a pick on a day the top no longer has', () => {
    const settled = settleChoices(
      ['2026-11-12', '2026-11-13'],
      { [missionScope(1)]: ['2026-11-12', '2026-11-13'], [epicScope(20)]: ['2026-11-12'] },
      parentOf,
    )
    expect(settled[missionScope(1)]).toEqual(['2026-11-12', '2026-11-13'])
    const after = settleChoices(['2026-11-13', '2026-11-14'], settled, parentOf)
    expect(after[missionScope(1)]).toEqual(['2026-11-13'])
    expect(after[epicScope(20)]).toBeUndefined()
  })

  it('drops a project pick when its mission narrows away from that day', () => {
    const settled = settleChoices(
      ['2026-11-12', '2026-11-13'],
      { [missionScope(1)]: ['2026-11-13'], [epicScope(10)]: ['2026-11-12'] },
      parentOf,
    )
    expect(settled[epicScope(10)]).toBeUndefined()
  })

  it('drops every pick under a single day on top', () => {
    const settled = settleChoices(['2026-11-13'], { [missionScope(1)]: ['2026-11-12'] }, parentOf)
    expect(settled).toEqual({})
  })

  it('keeps picks as they are when nothing is chosen above', () => {
    const picks = { [missionScope(1)]: ['2026-11-12'] }
    expect(settleChoices([], picks, parentOf)).toEqual(picks)
  })
})
