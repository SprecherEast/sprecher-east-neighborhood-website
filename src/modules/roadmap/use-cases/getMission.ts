import 'server-only'

import { planActivity } from '../domain/activity'
import { parseMissionNumber } from '../domain/paths'
import { findMission } from '../domain/plan'
import { getPlan } from './getPlan'

/** A mission the public plan lists, with its activity on the plan's shared scale, or `undefined` */
export async function getMission(number: number) {
  const plan = await getPlan()
  const mission = findMission(plan, number)
  if (!mission) return undefined
  const now = new Date()
  const activity = planActivity(plan.milestones, now)
  const mine = activity.missions.find((m) => m.milestoneNumber === number)
  return {
    mission,
    now,
    activity: { series: mine?.series ?? [], max: activity.max, stepLabel: activity.stepLabel },
  }
}

/** The same, from the address segment: a malformed one answers like an unknown number */
export async function getMissionFromAddress(value: string) {
  const number = parseMissionNumber(value)
  return number === undefined ? undefined : getMission(number)
}

/** Every mission the plan lists, for the pages to build ahead of time */
export async function listMissionNumbers(): Promise<number[]> {
  return (await getPlan()).milestones.map((m) => m.number)
}
