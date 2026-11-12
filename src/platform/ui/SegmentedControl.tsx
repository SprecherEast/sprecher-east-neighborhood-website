import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Button } from './Button'

export type SegmentedOption = { key: string; label: string }

/**
 * A few short options joined into one control, one of them picked (#1118): a switch between tax
 * years, say. The options share one small 36 px box with one border and divider lines between them; the picked one is filled with the accent and says so to
 * screen readers (`aria-pressed`). Each option is the kit's `Button`, so choosing, focus and the
 * 44 px tap area work as everywhere else. It draws what it is given and keeps no state of its own,
 * so use it from a client component.
 */
export function SegmentedControl({
  label,
  labelledBy,
  options,
  selected,
  onSelect,
  className,
}: {
  /** What the group is, for screen readers; leave out when a visible label names it (`labelledBy`) */
  label?: string
  /** The id of the visible label that names the group */
  labelledBy?: string
  options: readonly SegmentedOption[]
  /** The index of the picked option */
  selected: number
  onSelect: (index: number) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn(
        'inline-flex h-9 shrink-0 self-center overflow-hidden rounded-lg border border-accent-dark bg-background',
        className,
      )}
    >
      {options.map((option, index) => (
        <Button
          key={option.key}
          variant={index === selected ? 'accent' : 'ghost'}
          className={cn(
            'h-full min-h-0 flex-1 rounded-none px-3 text-sm whitespace-nowrap focus-visible:-outline-offset-2',
            index > 0 && 'border-l border-accent-dark',
          )}
          aria-pressed={index === selected}
          onClick={() => onSelect(index)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
