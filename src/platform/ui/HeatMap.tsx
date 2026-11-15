import React from 'react'

import { cn } from '@/platform/lib/cn'

import { HeatCell, type DaySelection } from './HeatCell'

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
const SHADES = [
  'bg-done/30 hover:bg-done/30',
  'bg-done/50 hover:bg-done/50',
  'bg-done/75 hover:bg-done/75',
  'bg-done hover:bg-done',
] as const
const NOTHING = 'bg-done/10 hover:bg-done/10'

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
  /** Makes the days pressable, to choose some of them; the map is then a group of buttons, not an image */
  selection?: DaySelection
  /** The day that wears the ring: defaults to the last day, `null` for none (a past month has no today) */
  today?: string | null
  /** Whether the days after the last one in its week are dashed outlines, "still to come"; a finished period leaves them empty. Defaults to true */
  toCome?: boolean
  /** A short caption under the squares that says what they show, with a Less-to-More key beside it */
  caption?: string
  className?: string
}

/**
 * The caption and a Less-to-More key built from the same shades as the squares. The text steps
 * down on the narrowest phones and up from tablet widths so the two share one line; only below
 * that does the whole key move under the caption. On the calendar it sits in
 * the same grid as the rows, in the columns of the squares, so the caption starts at the first
 * square and the key ends at the last. The swatches are decoration: `label` already lists every
 * value.
 */
function HeatKey({ caption }: { caption: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2 text-sm text-foreground max-[374px]:text-xs sm:text-base">
      <span>{caption}</span>
      <span className="flex shrink-0 items-center gap-1">
        <span>Less</span>
        {[NOTHING, ...SHADES].map((shade) => (
          <span
            key={shade}
            aria-hidden="true"
            data-heat-key-swatch=""
            className={cn('size-3.5 rounded-sm sm:size-4.5', shade)}
          />
        ))}
        <span>More</span>
      </span>
    </div>
  )
}

/** One calendar square; the weekday letters and the dashed days to come share its size */
const SQUARE = 'block h-7 w-full rounded-md sm:h-8'
/** Pressable squares are a size larger, the most seven columns and their dates fit in 320 px */
const PRESSABLE_SQUARE = 'block h-11 w-full rounded-md sm:h-10'
/** A calendar row: the Monday's date, then seven squares. The first column's width is set here alone */
/** Space on the right of the whole calendar: half the date column and its gap, so the squares sit evenly beside the dates */
const CALENDAR_INSET = 'pr-4'
const CALENDAR_ROW = 'grid grid-cols-[1.75rem_repeat(7,1fr)] items-center gap-1 sm:gap-1.5'

/** The date of the Monday of the week a `yyyy-mm-dd` day falls in, as a day of its month */
function mondayOf(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date - mondayIndex(day))).getUTCDate()
}

/** An image that lists its values, or with a selection a group of buttons named by what it shows */
const wrapper = (label: string, selection?: DaySelection) =>
  selection
    ? ({ role: 'group', 'aria-label': label } as const)
    : ({ role: 'img', 'aria-label': label } as const)

export function HeatMap({
  days,
  values,
  label,
  variant,
  max,
  selection,
  caption,
  today,
  toCome = true,
  className,
}: HeatMapProps) {
  const ringDay = today === undefined ? days[days.length - 1] : today
  const top = max ?? Math.max(0, ...values)
  const square = selection ? PRESSABLE_SQUARE : SQUARE

  if (variant === 'week') {
    return (
      <div {...wrapper(label, selection)} className={cn('w-full', className)}>
        <div
          aria-hidden={selection ? undefined : 'true'}
          className="space-y-1 text-center text-xs text-muted-foreground"
        >
          <div aria-hidden="true" className="grid auto-cols-fr grid-flow-col gap-1">
            {days.map((day) => (
              <span key={day}>{LETTERS[mondayIndex(day)]}</span>
            ))}
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-1">
            {days.map((day, index) => (
              <HeatCell
                key={day}
                day={day}
                value={values[index] ?? 0}
                className={cn(
                  'block w-full rounded-md',
                  selection ? 'h-11 lg:h-9' : 'h-5',
                  shadeFor(values[index] ?? 0, top),
                )}
                ringed={day === ringDay}
                selection={selection}
              />
            ))}
          </div>
          {caption && <HeatKey caption={caption} />}
        </div>
      </div>
    )
  }

  // calendar: blank cells pad the first week back to its Monday; the days after the last one in
  // its week are still to come
  const lead = days.length > 0 ? mondayIndex(days[0]) : 0
  const cells: ({ day: string; value: number } | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...days.map((day, index) => ({ day, value: values[index] ?? 0 })),
  ]
  const trail = (DAYS_IN_WEEK - (cells.length % DAYS_IN_WEEK)) % DAYS_IN_WEEK
  const rows = Array.from({ length: (cells.length + trail) / DAYS_IN_WEEK }, (_, row) =>
    Array.from({ length: DAYS_IN_WEEK }, (_, col) => cells[row * DAYS_IN_WEEK + col]),
  )

  return (
    <div {...wrapper(label, selection)} className={cn('w-full', className)}>
      <div
        aria-hidden={selection ? undefined : 'true'}
        className={cn(
          'w-full space-y-1 text-xs text-muted-foreground sm:space-y-1.5',
          CALENDAR_INSET,
        )}
      >
        <div aria-hidden="true" className={CALENDAR_ROW}>
          <span />
          {[...LETTERS].map((letter, index) => (
            <span key={index} className="text-center">
              {letter}
            </span>
          ))}
        </div>
        {rows.map((row, rowIndex) => {
          const first = row.find((cell) => cell !== undefined && cell !== null)
          return (
            <div key={rowIndex} data-heat-row="" className={CALENDAR_ROW}>
              <span className="pr-1 text-right tabular-nums">
                {first ? mondayOf(first.day) : ''}
              </span>
              {row.map((cell, colIndex) => {
                if (cell === undefined && !toCome) return <span key={colIndex} className={square} />
                if (cell === undefined) {
                  return (
                    <span
                      key={colIndex}
                      data-heat-future=""
                      className={cn(square, 'border border-dashed border-border')}
                    />
                  )
                }
                if (cell === null) return <span key={colIndex} className={square} />
                return (
                  <HeatCell
                    key={cell.day}
                    day={cell.day}
                    value={cell.value}
                    className={cn(square, shadeFor(cell.value, top))}
                    ringed={cell.day === ringDay}
                    selection={selection}
                  />
                )
              })}
            </div>
          )
        })}
        {caption && (
          <div data-heat-key-row="" className={CALENDAR_ROW}>
            <span />
            <div className="col-span-7">
              <HeatKey caption={caption} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
