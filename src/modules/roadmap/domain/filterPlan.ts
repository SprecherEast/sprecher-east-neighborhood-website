import {
  type Picks,
  type Scope,
  allowedPick,
  effectiveDays,
  epicScope,
  matchesDays,
  missionScope,
  settleChoices,
  stripEnabled,
} from './dayFilter'
import { lastDays } from './series'
import type { Plan, PlanEpic, PlanIssue, PlanMilestone } from './types'

/** The week strip every mission and project draws */
const STRIP_DAYS = 7

/** What a mission or a project needs to draw itself once the day filter is applied */
export type Level = {
  scope: Scope
  /** The issues the level above allows: what its week strip counts, so its own pick never empties it */
  weekIssues: PlanIssue[]
  /** The days picked on this level, always ones it allows */
  pick: string[]
  /** The strip's days that can be pressed */
  enabled: string[]
  /** One day is chosen above, so nothing can be picked here */
  locked: boolean
  /** The days the level above filters by: the one fixed day when `locked` */
  parent: string[]
}

export type ScopedEpic = Level & { epic: PlanEpic }
export type ScopedMission = Level & { mission: PlanMilestone; epics: ScopedEpic[] }

export type FilteredPlan = {
  missions: ScopedMission[]
  unscheduled: ScopedEpic[]
  /** How many issues are shown */
  total: number
}

/** Every mission and project with its parent, parents first; a mission and a project with no mission sit under the top map */
export function planParents(plan: Plan): Record<Scope, Scope | null> {
  const parents: Record<Scope, Scope | null> = {}
  for (const mission of plan.milestones) {
    parents[missionScope(mission.number)] = null
    for (const epic of mission.epics) parents[epicScope(epic.number)] = missionScope(mission.number)
  }
  for (const epic of plan.unscheduled) parents[epicScope(epic.number)] = null
  return parents
}

function level(
  scope: Scope,
  issues: PlanIssue[],
  parent: readonly string[],
  picks: Picks,
  now: Date,
): Level & { days: string[] } {
  const pick = picks[scope] ?? []
  return {
    scope,
    weekIssues: issues.filter((issue) => matchesDays(issue, parent)),
    pick,
    enabled: stripEnabled(parent, lastDays(now, STRIP_DAYS)),
    locked: parent.length === 1,
    parent: [...parent],
    days: effectiveDays(parent, pick),
  }
}

/**
 * Whether the level itself holds a pick the level above allows. Such a level stays on the page
 * even when the day has nothing in it, so the day just pressed stays selected and can be pressed
 * again; a level with nothing only because of the days above is hidden.
 */
const pressed = (parent: readonly string[], pick: readonly string[]) =>
  allowedPick(parent, pick).length > 0

function scopeEpic(epic: PlanEpic, parent: readonly string[], picks: Picks, now: Date) {
  const { days, ...rest } = level(epicScope(epic.number), epic.children, parent, picks, now)
  const children = epic.children.filter((issue) => matchesDays(issue, days))
  if (days.length > 0 && children.length === 0 && !pressed(parent, rest.pick)) return null
  return { ...rest, epic: { ...epic, children } }
}

function scopeMission(mission: PlanMilestone, top: readonly string[], picks: Picks, now: Date) {
  const issues = mission.epics.flatMap((epic) => epic.children)
  const { days, ...rest } = level(missionScope(mission.number), issues, top, picks, now)
  const epics = mission.epics.flatMap((epic) => scopeEpic(epic, days, picks, now) ?? [])
  if (days.length > 0 && epics.length === 0 && !pressed(top, rest.pick)) return null
  return { ...rest, mission: { ...mission, epics: epics.map((scoped) => scoped.epic) }, epics }
}

const count = (epics: ScopedEpic[]) => epics.reduce((n, { epic }) => n + epic.children.length, 0)

/**
 * The plan narrowed to the issues opened or finished on the chosen days. Missions and projects are
 * containers, so one with no matching issue is hidden; with no day chosen anywhere the whole plan
 * shows. Picks the levels above no longer allow are ignored.
 */
export function filterPlan(
  plan: Plan,
  top: readonly string[],
  picks: Picks,
  now: Date,
): FilteredPlan {
  const settled = settleChoices(top, picks, planParents(plan))
  const missions = plan.milestones.flatMap(
    (mission) => scopeMission(mission, top, settled, now) ?? [],
  )
  const unscheduled = plan.unscheduled.flatMap((epic) => scopeEpic(epic, top, settled, now) ?? [])
  return {
    missions,
    unscheduled,
    total: missions.reduce((n, { epics }) => n + count(epics), 0) + count(unscheduled),
  }
}

/** The plan without the issues' descriptions, which only the issue's own page reads: what a client component needs to filter and draw it */
export function leanPlan(plan: Plan): Plan {
  const lean = <T extends PlanIssue>(issue: T): T => ({ ...issue, description: '' })
  const leanEpic = (epic: PlanEpic): PlanEpic => ({
    ...lean(epic),
    children: epic.children.map(lean),
  })
  return {
    ...plan,
    milestones: plan.milestones.map((mission) => ({
      ...mission,
      epics: mission.epics.map(leanEpic),
    })),
    unscheduled: plan.unscheduled.map(leanEpic),
  }
}
