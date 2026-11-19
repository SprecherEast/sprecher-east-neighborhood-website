import 'server-only'

import { parseIssueNumber } from '../domain/paths'
import { findMission } from '../domain/plan'
import { getPlan } from './getPlan'

/** A mission the public plan lists, with the time it was read at, or `undefined` */
export async function getMission(number: number) {
  const plan = await getPlan()
  const mission = findMission(plan, number)
  if (!mission) return undefined
  return { mission, now: new Date() }
}

/** The same, from the address segment: a malformed one answers like an unknown number */
export async function getMissionFromAddress(value: string) {
  const number = parseIssueNumber(value)
  return number === undefined ? undefined : getMission(number)
}

/** Every mission the plan lists, for the pages to build ahead of time */
export async function listMissionNumbers(): Promise<number[]> {
  return (await getPlan()).milestones.map((m) => m.number)
}
