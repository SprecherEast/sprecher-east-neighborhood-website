import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * How much happened each day, as squares: darker means more. `week` is a strip of the days it is
 * given that stretches to the width of its box, with a weekday letter above each square;
 * `calendar` is the same days as Monday-to-Sunday rows of medium squares, each row named by its
 * Monday's date, with the days still to come left as dashed outlines. The last day is today and
 * wears a ring. Shades step with each day's share of the largest value, so a quiet series still
 * reads, and a zero is a faint square, never a hole. It is never the only signal: `label` lists
 * every value for screen readers and the caller writes the figure beside it.
 */
const LETTERS = 'MTWTFSS'
const DAYS_IN_WEEK = 7

/** Shades from least to most, by share of the largest value; a day with nothing is the faintest */
const SHADES = ['bg-done/30', 'bg-done/50', 'bg-done/75', 'bg-done'] as const
const NOTHING = 'bg-done/10'

/** 0 for Monday to 6 for Sunday, read from the text of a `yyyy-mm-dd` day so no time zone moves it */
export function mondayIndex(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % DAYS_IN_WEEK
}

function shadeFor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return NOTHING
  const step = Math.min(SHADES.length - 1, Math.ceil((value / max) * SHADES.length) - 1)
  return SHADES[step]
}

export type HeatMapProps = {
  /** `yyyy-mm-dd`, oldest first, ending today */
  days: string[]
  /** The same length as `days`: how much happened each day */
  values: number[]
  /** What it shows, with every value, for screen readers: "Finished each day this week: 2, 0, 5" */
  label: string
  variant: 'week' | 'calendar'
  /** The value of the darkest square; share it between maps read side by side. Defaults to the largest value */
  max?: number
  className?: string
}

const RING = 'ring-2 ring-foreground'

export function HeatMap({ days, values, label, variant, max, className }: HeatMapProps) {
  const top = max ?? Math.max(0, ...values)

  if (variant === 'week') {
    return (
      <div role="img" aria-label={label} className={cn('w-full', className)}>
        <div aria-hidden="true" className="space-y-1 text-center text-xs text-muted-foreground">
          <div className="grid auto-cols-fr grid-flow-col gap-1">
            {days.map((day) => (
              <span key={day}>{LETTERS[mondayIndex(day)]}</span>
            ))}
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-1">
            {days.map((day, index) => (
              <span
                key={day}
                data-heat-cell=""
                className={cn(
                  'block h-5 rounded-md',
                  shadeFor(values[index] ?? 0, top),
                  index === days.length - 1 && RING,
                )}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // calendar: pad the first week back to its Monday and the last one on to its Sunday
  const lead = days.length > 0 ? mondayIndex(days[0]) : 0
  const cells: ({ day: string; value: number } | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...days.map((day, index) => ({ day, value: values[index] ?? 0 })),
  ]
  const trail = (DAYS_IN_WEEK - (cells.length % DAYS_IN_WEEK)) % DAYS_IN_WEEK
  const rows = Array.from({ length: Math.ceil((cells.length + trail) / DAYS_IN_WEEK) }, (_, row) =>
    Array.from({ length: DAYS_IN_WEEK }, (_, col) => cells[row * DAYS_IN_WEEK + col] ?? null),
  )
  const mondays = rows.map((row, index) => {
    const first = row.find((cell) => cell !== null)
    return first ? Number(first.day.split('-')[2]) - mondayIndex(first.day) : index
  })

  return (
    <div role="img" aria-label={label} className={cn('flex justify-center', className)}>
      <div aria-hidden="true" className="space-y-1 text-xs text-muted-foreground sm:space-y-1.5">
        <div className="grid grid-cols-[1.75rem_repeat(7,1fr)] items-center gap-1 text-center sm:gap-1.5">
          <span />
          {[...LETTERS].map((letter, index) => (
            <span key={index} className="w-7 sm:w-8">
              {letter}
            </span>
          ))}
        </div>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            data-heat-row=""
            className="grid grid-cols-[1.75rem_repeat(7,1fr)] items-center gap-1 sm:gap-1.5"
          >
            <span className="pr-1 text-right tabular-nums">{mondays[rowIndex]}</span>
            {row.map((cell, colIndex) => {
              if (cell === null) {
                const future =
                  rowIndex === rows.length - 1 && colIndex >= row.findIndex((c) => c === null)
                return future && days.length > 0 ? (
                  <span
                    key={colIndex}
                    data-heat-future=""
                    className="block size-7 rounded-md border border-dashed border-border sm:size-8"
                  />
                ) : (
                  <span key={colIndex} className="block size-7 sm:size-8" />
                )
              }
              return (
                <span
                  key={cell.day}
                  data-heat-cell=""
                  className={cn(
                    'block size-7 rounded-md sm:size-8',
                    shadeFor(cell.value, top),
                    cell.day === days[days.length - 1] && RING,
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
