import React from 'react'

import { planParents } from '../domain/filterPlan'
import type { Plan } from '../domain/types'
import { PlanFilterProvider as Provider } from './PlanFilter.client'

/** The day filter for the plan page, given the plan so it knows which mission holds which project */
export function PlanFilterProvider({ plan, children }: { plan: Plan; children: React.ReactNode }) {
  return <Provider parentOf={planParents(plan)}>{children}</Provider>
}
