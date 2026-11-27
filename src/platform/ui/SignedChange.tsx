import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'
import type { ChangeDirection } from '@/platform/lib/chart/change'

const DIRECTION = {
  up: { Icon: ArrowUp, spoken: 'Up' },
  down: { Icon: ArrowDown, spoken: 'Down' },
  same: { Icon: Minus, spoken: 'No change' },
} as const satisfies Record<ChangeDirection, { Icon: unknown; spoken: string }>

export type SignedChangeProps = {
  direction: ChangeDirection
  /** The signed amount, already written: "+$25.0M" */
  amount: string
  /** The signed percent, already written: "+5.5%"; left out when there was nothing before */
  percent: string | null
  className?: string
}

/**
 * A change as an arrow, the signed amount and the percent in brackets (#1503). The sign is in the
 * text, the arrow repeats the direction, and a screen reader hears "Up", "Down" or "No change",
 * so colour is never the cue. It is neutral on purpose: more or less money is not good or bad by
 * itself. `ChangeFigure` and the compact rows both use it, so the two read the same.
 */
export function SignedChange({ direction, amount, percent, className }: SignedChangeProps) {
  const { Icon, spoken } = DIRECTION[direction]
  return (
    <span data-signed-change={direction} className={cn('inline-flex items-start gap-1', className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="font-semibold tabular-nums">
        <span className="sr-only">{spoken}: </span>
        {amount}
        {percent && ` (${percent})`}
      </span>
    </span>
  )
}
