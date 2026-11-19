import { describe, expect, it } from 'vitest'

import { epicScope, missionScope } from './dayFilter'
import { filterPlan, leanPlan, planParents } from './filterPlan'
import type { Plan, PlanEpic, PlanIssue, PlanMilestone } from './types'

// Fri 2026-11-13 noon in Chicago
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
  ...issue(number),
  children,
})
const mission = (number: number, epics: PlanEpic[]): PlanMilestone => ({
  number,
  title: `Mission ${number}`,
  description: '',
  state: 'open',
  dueOn: null,
  epics,
})

const plan: Plan = {
  generatedAt: NOW.toISOString(),
  hiddenCount: 0,
  milestones: [
    mission(1, [
      epic(10, [finished(100, '2026-11-12T18:00:00Z'), finished(101, '2026-11-13T18:00:00Z')]),
      epic(11, [finished(102, '2026-11-05T18:00:00Z')]),
    ]),
    mission(2, [epic(20, [finished(200, '2026-11-05T18:00:00Z')])]),
  ],
  unscheduled: [epic(30, [finished(300, '2026-11-12T18:00:00Z')])],
}

const numbers = (result: ReturnType<typeof filterPlan>) =>
  result.missions.map((m) => [m.mission.number, m.epics.map((e) => e.epic.children.length)])

describe('planParents', () => {
  it('names the parent of every mission and project, parents first', () => {
    expect(planParents(plan)).toEqual({
      [missionScope(1)]: null,
      [epicScope(10)]: missionScope(1),
      [epicScope(11)]: missionScope(1),
      [missionScope(2)]: null,
      [epicScope(20)]: missionScope(2),
      [epicScope(30)]: null,
    })
  })
})

describe('filterPlan', () => {
  it('shows everything when no day is chosen', () => {
    const all = filterPlan(plan, [], {}, NOW)
    expect(numbers(all)).toEqual([
      [1, [2, 1]],
      [2, [1]],
    ])
    expect(all.unscheduled).toHaveLength(1)
    expect(all.total).toBe(5)
  })

  it('keeps only the issues on the chosen days and hides what has none', () => {
    const result = filterPlan(plan, ['2026-11-12'], {}, NOW)
    expect(numbers(result)).toEqual([[1, [1]]])
    expect(result.unscheduled).toHaveLength(1)
    expect(result.total).toBe(2)
  })

  it('treats several days as any of them', () => {
    const result = filterPlan(plan, ['2026-11-12', '2026-11-13'], {}, NOW)
    expect(numbers(result)).toEqual([[1, [2]]])
  })

  it('lets a project narrow within two chosen days and no further', () => {
    const picks = { [epicScope(10)]: ['2026-11-13'] }
    const result = filterPlan(plan, ['2026-11-12', '2026-11-13'], picks, NOW)
    const project = result.missions[0].epics[0]
    expect(project.epic.children.map((c) => c.number)).toEqual([101])
    expect(project.pick).toEqual(['2026-11-13'])
    expect(project.enabled).toEqual(['2026-11-12', '2026-11-13'])
  })

  it('locks the strips below a single day and ignores picks there', () => {
    const picks = { [epicScope(10)]: ['2026-11-13'] }
    const result = filterPlan(plan, ['2026-11-12'], picks, NOW)
    const project = result.missions[0].epics[0]
    expect(project.locked).toBe(true)
    expect(project.enabled).toEqual([])
    expect(project.pick).toEqual([])
    expect(project.epic.children.map((c) => c.number)).toEqual([100])
  })

  it('draws a strip from the issues the level above allows, not its own pick', () => {
    const picks = { [epicScope(10)]: ['2026-11-13'] }
    const result = filterPlan(plan, ['2026-11-12', '2026-11-13'], picks, NOW)
    expect(result.missions[0].epics[0].weekIssues.map((i) => i.number)).toEqual([100, 101])
  })
})

describe('filterPlan: a pick that matches nothing', () => {
  const only13 = {
    ...plan,
    milestones: [mission(3, [epic(40, [finished(400, '2026-11-13T18:00:00Z')])])],
    unscheduled: [],
  }
  const top = ['2026-11-12', '2026-11-13']

  it('keeps the mission, so the day just pressed stays selected and can be pressed again', () => {
    const result = filterPlan(only13, top, { [missionScope(3)]: ['2026-11-12'] }, NOW)
    expect(result.missions).toHaveLength(1)
    expect(result.missions[0].pick).toEqual(['2026-11-12'])
    expect(result.missions[0].epics).toEqual([])
    expect(result.total).toBe(0)
  })

  it('shows a project with no issues when no day is chosen', () => {
    const empty = { ...only13, milestones: [mission(3, [epic(40, [])])] }
    expect(filterPlan(empty, [], {}, NOW).missions[0].epics).toHaveLength(1)
  })

  it('still hides a mission that has nothing only because of the days above', () => {
    expect(filterPlan(only13, ['2026-11-12'], {}, NOW).missions).toEqual([])
  })

  it('keeps a project the same way, with its mission, when its day has nothing in it', () => {
    const projectOnly13 = {
      ...only13,
      milestones: [
        mission(3, [
          epic(40, [finished(400, '2026-11-13T18:00:00Z')]),
          epic(41, [finished(401, '2026-11-12T18:00:00Z')]),
        ]),
      ],
    }
    const result = filterPlan(
      projectOnly13,
      top,
      { [missionScope(3)]: top, [epicScope(40)]: ['2026-11-12'] },
      NOW,
    )
    const kept = result.missions[0].epics.find(({ epic: e }) => e.number === 40)
    expect(kept?.pick).toEqual(['2026-11-12'])
    expect(kept?.epic.children).toEqual([])
    expect(result.total).toBe(1)
  })
})

describe('leanPlan', () => {
  it('empties every description and keeps the rest', () => {
    const wordy: Plan = {
      ...plan,
      milestones: [mission(1, [epic(10, [issue(100, { description: 'a long body' })])])],
      unscheduled: [{ ...epic(30, []), description: 'about the project' }],
    }
    const lean = leanPlan(wordy)
    expect(lean.milestones[0].epics[0].children[0]).toEqual(issue(100))
    expect(lean.unscheduled[0].description).toBe('')
    expect(lean.unscheduled[0].number).toBe(30)
  })
})
