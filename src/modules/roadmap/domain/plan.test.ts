import { describe, expect, it } from 'vitest'

import { buildPlan, findPlanIssue } from './plan'
import type { RawEpic, RawIssue, RawMilestone } from './types'

const NOW = '2026-11-09T12:00:00Z'

const issue = (number: number, over: Partial<RawIssue> = {}): RawIssue => ({
  number,
  title: `Issue ${number}`,
  body: `Body ${number}`,
  state: 'open',
  stateReason: null,
  closedAt: null,
  labels: [],
  milestoneNumber: null,
  url: `https://github.com/o/r/issues/${number}`,
  ...over,
})

const milestone = (number: number, over: Partial<RawMilestone> = {}): RawMilestone => ({
  number,
  title: `Milestone ${number}`,
  description: '',
  state: 'open',
  dueOn: null,
  ...over,
})

const epic = (number: number, children: RawIssue[], over: Partial<RawIssue> = {}): RawEpic => ({
  epic: issue(number, { labels: ['epic'], ...over }),
  children,
})

describe('buildPlan', () => {
  it('puts each epic under its milestone and its issues under the epic', () => {
    const plan = buildPlan({
      generatedAt: NOW,
      milestones: [milestone(1)],
      epics: [epic(10, [issue(11), issue(12, { state: 'closed' })], { milestoneNumber: 1 })],
    })

    expect(plan.milestones).toHaveLength(1)
    const [e] = plan.milestones[0]?.epics
    expect(e?.number).toBe(10)
    expect(e?.children.map((c) => [c.number, c.state])).toEqual([
      [11, 'open'],
      [12, 'done'],
    ])
    expect(plan.hiddenCount).toBe(0)
  })

  it('marks a closed issue that was not planned', () => {
    const plan = buildPlan({
      generatedAt: NOW,
      milestones: [],
      epics: [epic(10, [issue(11, { state: 'closed', stateReason: 'not_planned' })])],
    })
    expect(plan.unscheduled[0]?.children[0]?.state).toBe('not-planned')
  })

  it('keeps epics without a milestone, or with an unknown one, in unscheduled', () => {
    const plan = buildPlan({
      generatedAt: NOW,
      milestones: [milestone(1)],
      epics: [epic(10, [], { milestoneNumber: null }), epic(20, [], { milestoneNumber: 99 })],
    })
    expect(plan.unscheduled.map((e) => e.number)).toEqual([10, 20])
  })

  it('sorts milestones open first, then by due date with none last, then by number', () => {
    const plan = buildPlan({
      generatedAt: NOW,
      milestones: [
        milestone(1, { state: 'closed', dueOn: '2026-01-01T00:00:00Z' }),
        milestone(2, { dueOn: null }),
        milestone(3, { dueOn: '2026-12-01T00:00:00Z' }),
        milestone(4, { dueOn: '2026-11-01T00:00:00Z' }),
      ],
      epics: [],
    })
    expect(plan.milestones.map((m) => m.number)).toEqual([4, 3, 2, 1])
  })

  it('drops screened issues and counts them', () => {
    const plan = buildPlan({
      generatedAt: NOW,
      milestones: [milestone(1)],
      epics: [
        epic(10, [issue(11), issue(12, { labels: ['infra'] }), issue(13, { body: 'a@b.co' })], {
          milestoneNumber: 1,
        }),
      ],
    })
    expect(plan.milestones[0]?.epics[0]?.children.map((c) => c.number)).toEqual([11])
    expect(plan.hiddenCount).toBe(2)
  })

  it('takes the issues of a screened epic with it, and counts them all', () => {
    const plan = buildPlan({
      generatedAt: NOW,
      milestones: [milestone(1)],
      epics: [
        epic(10, [issue(11), issue(12)], { milestoneNumber: 1, labels: ['epic', 'needs owner'] }),
      ],
    })
    expect(plan.milestones[0]?.epics).toEqual([])
    expect(plan.hiddenCount).toBe(3)
  })
})

describe('milestone descriptions', () => {
  it('leaves out a description that holds something screened, keeping the milestone', () => {
    const plan = buildPlan({
      generatedAt: NOW,
      milestones: [
        milestone(1, { description: 'Mail ada@example.com' }),
        milestone(2, { description: 'Fine' }),
      ],
      epics: [],
    })
    expect(plan.milestones.map((m) => [m.number, m.description])).toEqual([
      [1, ''],
      [2, 'Fine'],
    ])
  })
})

describe('findPlanIssue', () => {
  const plan = buildPlan({
    generatedAt: NOW,
    milestones: [milestone(1)],
    epics: [epic(10, [issue(11)], { milestoneNumber: 1 })],
  })

  it('finds an epic or an issue by number', () => {
    expect(findPlanIssue(plan, 10)?.title).toBe('Issue 10')
    expect(findPlanIssue(plan, 11)?.title).toBe('Issue 11')
  })

  it('finds nothing for a screened or unknown number', () => {
    expect(findPlanIssue(plan, 999)).toBeUndefined()
  })
})
