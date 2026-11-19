'use client'

import { Check, Circle, X } from 'lucide-react'
import React from 'react'

import { formatDayLabel, formatDayShort } from '@/platform/lib/formatDateTime'
import { Button } from '@/platform/ui/Button'
import { HeatMap } from '@/platform/ui/HeatMap'
import { PeriodNav } from '@/platform/ui/PeriodNav'

import type { DayCount } from '../domain/dayFilter'
import { earliestStep, mapWindow } from '../domain/mapWindow'
import { usePlanFilter } from './PlanFilter.client'

/**
 * The activity map as the plan's day filter: press a day to filter the missions and projects
 * below to the issues opened or finished on it, press it again to take it out. It starts on the
 * last four weeks; the arrows above it step back one calendar month at a time, and forward again
 * to the four weeks. A chosen day stays chosen while browsing. Each chosen day is a pill under the
 * map with its two counts (a check for finished, a dot for opened) and a button to remove it.
 * Pills wrap onto new lines. Nothing is chosen until someone presses a day.
 */
export function DayFilterMap({
  activity,
  now,
  since,
}: {
  /** Finished and opened on each day something happened */
  activity: Record<string, DayCount>
  now: Date
  /** The first day anything happened, `yyyy-mm-dd`; the map cannot step back past its month */
  since: string | null
}) {
  const { top, toggleTop } = usePlanFilter()
  const [step, setStep] = React.useState(0)
  const { days, title } = mapWindow(now, step)
  const values = days.map((day) => activity[day]?.finished ?? 0)
  const earliest = earliestStep(now, since)
  const heading = step === 0 ? 'Activity over four weeks' : `Activity in ${title}`
  const label = `${heading}, issues finished each day: ${values.join(', ')}. Press a day to show only the issues opened or finished on it.`

  return (
    <div className="my-2 space-y-4 sm:my-3">
      <PeriodNav
        title={title}
        previousLabel="Earlier month"
        nextLabel={step === 1 ? 'Back to the last four weeks' : 'Later month'}
        onPrevious={() => setStep(step + 1)}
        onNext={() => setStep(step - 1)}
        previousDisabled={step >= earliest}
        nextDisabled={step === 0}
      />
      <HeatMap
        variant="calendar"
        days={days}
        values={values}
        label={label}
        caption="Work done per day"
        today={step === 0 ? undefined : null}
        toCome={step === 0}
        selection={{ selected: top, onToggle: toggleTop }}
      />
      {top.length > 0 && (
        <ul aria-label="Days chosen" className="flex flex-wrap justify-center gap-2">
          {top.map((day) => {
            const { finished, opened } = activity[day] ?? { finished: 0, opened: 0 }
            return (
              <li key={day}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 px-3"
                  onClick={() => toggleTop(day)}
                  aria-label={`Remove ${formatDayLabel(day)}: ${finished} finished, ${opened} opened`}
                  iconEnd={<X aria-hidden="true" />}
                >
                  <span>{formatDayShort(day)}</span>
                  <span className="inline-flex items-center gap-1 text-done-strong tabular-nums">
                    <Check aria-hidden="true" />
                    {finished}
                  </span>
                  <span className="inline-flex items-center gap-1 text-success-strong tabular-nums">
                    <Circle aria-hidden="true" className="fill-current" />
                    {opened}
                  </span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
