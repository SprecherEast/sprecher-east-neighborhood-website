import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Text } from './Text'
import { ShareBar } from './ShareBar.client'
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
 * One whole as a bill (#1111, #1118), laid out like a receipt: its title on top, one bar whose slices are as wide as their shares,
 * and under it a receipt that names every slice with its color, percent and dollars, in the bar's
 * own order, since both are made from the same slices. The highlighted slice's row has a soft primary
 * fill and bolder text (the tone's `row`), and every row has the same side padding, so the columns
 * stay level. The receipt is one grid of three columns
 * with fixed widths for the percent and the amount, so each column lines up from row to row and
 * the block keeps its height when the amounts change. The total flashes the accent once each time
 * `pulseKey` changes, unless motion is reduced. The caller writes `label`, what the bar says to
 * screen readers.
 */
export function ShareBill({
  slices,
  label,
  title,
  total,
  pulseKey,
  className,
}: {
  slices: readonly ShareSlice[]
  label: string
  /** The bill's name, at the top with no amount beside it */
  title?: string
  /** What the amounts add up to: the last line, as on a receipt */
  total?: { label: string; amount: string }
  /** Changes each time the total should flash once */
  pulseKey?: number
  className?: string
}) {
  return (
    <div data-share-bill className={cn('space-y-1.5', className)}>
      {title && (
        <Text variant="subsection" as="p">
          {title}
        </Text>
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
      <ul className="grid grid-cols-[1fr_1.5rem_2.5rem] gap-x-0.5 text-xs min-[24rem]:grid-cols-[1fr_2rem_3.5rem] min-[24rem]:gap-x-1 min-[24rem]:text-sm">
        {slices.map((slice) => (
          <li
            key={slice.key}
            className={cn(
              'col-span-3 grid min-h-5 grid-cols-subgrid items-center border-t border-border px-1 first:border-t-0',
              SHARE_TONES[slice.tone].row,
            )}
          >
            <span className="flex min-w-0 items-center gap-x-1 min-[24rem]:gap-x-2">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-block size-2 shrink-0 min-[24rem]:size-3',
                  SHARE_TONES[slice.tone].swatch,
                )}
              />
              <span className="whitespace-nowrap text-foreground">{slice.name}</span>
            </span>
            <span
              className={cn(
                'text-right whitespace-nowrap tabular-nums',
                SHARE_TONES[slice.tone].row ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {slice.percent}%
            </span>
            <span className="text-right font-semibold whitespace-nowrap text-foreground tabular-nums">
              {slice.amount}
            </span>
          </li>
        ))}
      </ul>
      {total && (
        <p
          key={pulseKey}
          className={cn(
            'flex min-h-6 items-center justify-between gap-x-2 border-t-2 border-foreground px-1 pt-1 font-bold text-foreground',
            pulseKey ? 'total-pulse' : undefined,
          )}
        >
          <span>{total.label}</span>
          <span className="tabular-nums">{total.amount}</span>
        </p>
      )}
    </div>
  )
}
