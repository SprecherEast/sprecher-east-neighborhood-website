import 'server-only'

import { cache } from 'react'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'

import { logServerFailure } from '@/platform/service'

import { fetchRawPlan } from '../data/github'
import { buildPlan } from '../domain/plan'
import type { Plan } from '../domain/types'

const emptyPlan = (): Plan => ({
  generatedAt: new Date().toISOString(),
  milestones: [],
  unscheduled: [],
  hiddenCount: 0,
})

/**
 * The public plan. At run time a failed read throws, so Next keeps the last good page and tries
 * again at the next visit. While building, it gives an empty plan instead, so a deploy never fails
 * because GitHub was out of reach: the page fills in at its first visit.
 */
export async function loadPlan(): Promise<Plan> {
  try {
    return buildPlan({ ...(await fetchRawPlan()), generatedAt: new Date().toISOString() })
  } catch (error) {
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) throw error
    logServerFailure('Reading the plan from GitHub', error)
    return emptyPlan()
  }
}

/** One read per request, shared by the page and its metadata */
export const getPlan = cache(loadPlan)
