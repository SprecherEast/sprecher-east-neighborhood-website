'use client'

import React from 'react'

import { toggleDay } from '@/platform/lib/toggleDay'

import { type Picks, type Scope, settleChoices } from '../domain/dayFilter'

type PlanFilterState = {
  /** The days chosen on the top map, `yyyy-mm-dd`, oldest first; none means no filter */
  top: string[]
  /** The days picked on each mission and project, only ones the level above allows */
  picks: Picks
  toggleTop: (day: string) => void
  togglePick: (scope: Scope, day: string) => void
  /** Back to the whole plan: every chosen day and pick taken out */
  clear: () => void
}

const NO_FILTER: PlanFilterState = {
  top: [],
  picks: {},
  toggleTop: () => {},
  togglePick: () => {},
  clear: () => {},
}

const PlanFilterContext = React.createContext<PlanFilterState>(NO_FILTER)

/** The day filter's state; outside a provider nothing is chosen and nothing can be */
export const usePlanFilter = () => React.useContext(PlanFilterContext)

/**
 * Holds the days chosen on the plan page, so the map, its pills and the missions and projects
 * below read one state. Nothing is chosen at first, so the page loads, and shows without scripts,
 * as the whole plan. `parentOf` names each mission's and project's parent, so a change at the top
 * drops every lower pick it no longer allows.
 */
export function PlanFilterProvider({
  parentOf,
  children,
}: {
  parentOf: Record<Scope, Scope | null>
  children: React.ReactNode
}) {
  const [state, setState] = React.useState<{ top: string[]; picks: Picks }>({ top: [], picks: {} })

  const value = React.useMemo<PlanFilterState>(
    () => ({
      ...state,
      toggleTop: (day) =>
        setState(({ top, picks }) => {
          const next = toggleDay(top, day)
          return { top: next, picks: settleChoices(next, picks, parentOf) }
        }),
      clear: () => setState({ top: [], picks: {} }),
      togglePick: (scope, day) =>
        setState(({ top, picks }) => ({
          top,
          picks: settleChoices(
            top,
            { ...picks, [scope]: toggleDay(picks[scope] ?? [], day) },
            parentOf,
          ),
        })),
    }),
    [state, parentOf],
  )

  return <PlanFilterContext value={value}>{children}</PlanFilterContext>
}
