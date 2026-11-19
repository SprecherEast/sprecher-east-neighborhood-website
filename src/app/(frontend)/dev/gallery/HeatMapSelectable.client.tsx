'use client'

import React from 'react'

import { toggleDay } from '@/platform/lib/toggleDay'
import { HeatMap } from '@/platform/ui/HeatMap'

const DAYS = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
const VALUES = [0, 2, 5, 1, 3]

/** A week strip whose days can be pressed; two days can be pressed, the others are unavailable */
export function HeatMapSelectable({ limited }: { limited?: boolean }) {
  const [selected, setSelected] = React.useState<string[]>([])
  return (
    <HeatMap
      variant="week"
      days={DAYS}
      values={VALUES}
      label="Sample: finished this week, press a day to choose it"
      selection={{
        selected,
        enabled: limited ? DAYS.slice(3) : undefined,
        unavailableReason: 'not selected above',
        onToggle: (day) => setSelected((now) => toggleDay(now, day)),
      }}
    />
  )
}
