import React from 'react'

import { cn } from '@/platform/lib/cn'

import { ShareBar } from './ShareBar'
import { SHARE_TONES, type ShareTone } from './shareTones'

export type ShareSlice = {
  key: string
  name: string
  /** What the slice is worth, already written, such as "$3,467" */
  amount: string
  /** Its share, as the whole number written beside it */
  percent: number
  /** Its exact share, 0 to 100: the bar draws it this wide */
  share: number
  tone: ShareTone
}

/**
 * One whole as a bill (#1111): the total on top, one bar whose slices are as wide as their shares,
 * and under it a receipt that names every slice with its color, percent and dollars, in the bar's
 * own order, since both are made from the same slices. The receipt is one grid of three columns
 * with fixed widths for the percent and the amount, so each column lines up from row to row and
 * the block keeps its height when the amounts change. The total flashes the accent once each time
 * `pulseKey` changes, unless motion is reduced. The caller writes `label`, what the bar says to
 * screen readers.
 */
export function ShareBill({
  slices,
  label,
  total,
  pulseKey,
  className,
}: {
  slices: readonly ShareSlice[]
  label: string
  /** What the amounts add up to */
  total?: { label: string; amount: string }
  /** Changes each time the total should flash once */
  pulseKey?: number
  className?: string
}) {
  return (
    <div data-share-bill className={cn('space-y-2', className)}>
      {total && (
        <p
          key={pulseKey}
          className={cn(
            'flex min-h-7 items-center justify-between gap-x-2 font-semibold text-foreground',
            pulseKey ? 'total-pulse' : undefined,
          )}
        >
          <span>{total.label}</span>
          <span className="tabular-nums">{total.amount}</span>
        </p>
      )}
      <ShareBar
        label={label}
        slices={slices.map((slice) => ({
          key: slice.key,
          share: slice.share,
          tone: slice.tone,
          label: `${slice.percent}%`,
        }))}
      />
      <ul className="grid grid-cols-[1fr_2rem_4rem] gap-x-1.5 text-sm">
        {slices.map((slice) => (
          <li
            key={slice.key}
            className="col-span-3 grid min-h-7 grid-cols-subgrid items-center border-t border-border py-0.5 first:border-t-0"
          >
            <span className="flex min-w-0 items-center gap-x-2">
              <span
                aria-hidden="true"
                className={cn('inline-block size-3 shrink-0', SHARE_TONES[slice.tone].swatch)}
              />
              <span className="text-foreground">{slice.name}</span>
            </span>
            <span className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
              {slice.percent}%
            </span>
            <span className="text-right font-semibold whitespace-nowrap text-foreground tabular-nums">
              {slice.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
