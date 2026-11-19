import React from 'react'

import { cn } from '@/platform/lib/cn'

/**
 * One bar on its track: a muted rounded track and, on it, a fill as wide as `width` (a percent, 0 to
 * 100), the way the bill's rows and the breakdown's rows both draw it (#1196). The caller sets the
 * height through `className` and says what the mark is through `mark` (a `data-*` attribute tests and
 * scripts find it by). `reveal` is a class that animates the fill when drawn; `edge` outlines it.
 */
export function BarTrack({
  width,
  radius,
  className,
  fillClassName,
  mark,
  reveal,
  edge,
}: {
  width: number
  radius: number
  /** The svg's classes: its height, and any spacing */
  className?: string
  /** The fill's color: a `fill-*` class from a theme token */
  fillClassName: string
  mark: Record<`data-${string}`, string>
  reveal?: string
  /** The classes and width of an outline around the fill */
  edge?: { className: string; width: number }
}) {
  const fill = (
    <rect
      {...mark}
      width={`${width.toFixed(2)}%`}
      height="100%"
      rx={radius}
      className={cn(fillClassName, edge?.className)}
      strokeWidth={edge?.width}
    />
  )
  return (
    <svg aria-hidden="true" focusable="false" className={cn('block w-full', className)}>
      <rect width="100%" height="100%" rx={radius} className="fill-muted" />
      {reveal ? <g className={reveal}>{fill}</g> : fill}
    </svg>
  )
}
