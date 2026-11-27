import React from 'react'

import { SignedChange, type SignedChangeProps } from '@/platform/ui/SignedChange'
import { Text } from '@/platform/ui/Text'

/**
 * One compact row: the name and figure on the first line, the bar and the change under them, in a
 * fixed-width right column so every bar starts and ends on the same line; from
 * `sm` it is all one line, with the bar between the name and the figure so the rows line up.
 */
export function RankedRow({
  name,
  value,
  change,
  bar,
}: {
  name: string
  value: string
  change: Omit<SignedChangeProps, 'className'> | null
  bar: React.ReactNode
}) {
  return (
    <li
      data-ranked-row=""
      className="grid grid-cols-[minmax(0,1fr)_10rem] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem_9rem] sm:gap-y-0"
    >
      <Text variant="small" as="span" className="min-w-0 wrap-break-word text-foreground">
        {name}
      </Text>
      <Text
        variant="small"
        as="span"
        className="text-right font-semibold text-foreground tabular-nums sm:order-3"
      >
        {value}
      </Text>
      <span className="min-w-0 sm:order-2">{bar}</span>
      <Text variant="small" as="span" className="text-right text-foreground sm:order-4">
        {change ? <SignedChange {...change} className="text-sm" /> : null}
      </Text>
    </li>
  )
}
