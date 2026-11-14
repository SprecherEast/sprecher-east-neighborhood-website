import { Check, Slash } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'
import { formatDayLabel } from '@/platform/lib/formatDateTime'

import { Button } from './Button'

/** Which days of a heat map can be pressed, and what a press does */
export type DaySelection = {
  /** The days pressed now, `yyyy-mm-dd` */
  selected: readonly string[]
  /** The days that can be pressed; any other day is unavailable. Leave out when every day can */
  enabled?: readonly string[]
  /** Said after the day for an unavailable one, such as "not selected above" */
  unavailableReason?: string
  onToggle: (day: string) => void
}

/** The ring today wears on a map that only reads */
const HEAT_RING = 'ring-2 ring-foreground'
/** The ring a pressed square wears: set off from its shade by a gap, so it reads even on the darkest square beside another dark one */
const PRESSED_RING = 'ring-2 ring-foreground ring-offset-1 ring-offset-background'
/** The check a pressed square wears, in a disc that contrasts with every shade; shape, not colour alone, says it is chosen */
const SELECTED_MARK =
  'pointer-events-none grid size-5 place-items-center rounded-full bg-foreground text-background [&_svg]:size-3'

type HeatCellProps = {
  day: string
  value: number
  /** The square's size and shade classes */
  className: string
  /** Ring a square that only reads (today); a pressable one rings when it is pressed */
  ringed?: boolean
  selection?: DaySelection
}

/**
 * One day of a heat map: a plain square, or with a `selection` a button that says whether it is
 * pressed. An unavailable day is a muted, slashed square that cannot be reached or pressed and
 * says why, so it never depends on colour alone.
 */
export function HeatCell({ day, value, className, ringed, selection }: HeatCellProps) {
  if (!selection) {
    return <span data-heat-cell="" className={cn(className, ringed && HEAT_RING)} />
  }

  const enabled = !selection.enabled || selection.enabled.includes(day)
  const pressed = selection.selected.includes(day)
  // A pressed day that cannot be pressed is the one fixed by the level above: it keeps its shade,
  // ring and check, and is told apart from an unavailable day by being pressed
  const available = enabled || pressed
  const reason = selection.unavailableReason ? `, ${selection.unavailableReason}` : ''
  const name = `${formatDayLabel(day)}: ${value}${available ? '' : `, not available${reason}`}`

  return (
    <Button
      data-heat-cell=""
      variant="ghost"
      size="sm"
      aria-pressed={pressed}
      aria-label={name}
      disabled={!enabled}
      onClick={() => selection.onToggle(day)}
      className={cn(
        className,
        // Square, not button-sized; the invisible area reaches 2 px past each side, as the icon buttons do
        'relative flex min-h-0 min-w-0 p-0 after:absolute after:-inset-0.5 after:content-[""] lg:min-h-0 lg:px-0',
        available
          ? 'enabled:hover:ring-2 enabled:hover:ring-foreground/50 disabled:opacity-100'
          : 'border border-border bg-muted text-muted-foreground opacity-100 hover:bg-muted [&_svg]:size-full',
        pressed && PRESSED_RING,
      )}
    >
      {pressed && (
        <span data-heat-selected="" aria-hidden="true" className={SELECTED_MARK}>
          <Check strokeWidth={3} />
        </span>
      )}
      {!available && <Slash aria-hidden="true" className="p-1.5 text-muted-foreground" />}
    </Button>
  )
}
