import React, { type ReactNode } from 'react'

import { cn } from '@/platform/lib/cn'

import { Text } from './Text'
import { ShareBar } from './ShareBar.client'
import { SHARE_TONES, type ShareTone } from './shareTones'

export type ShareSlice = {
  key: string
  name: string
  /**
   * What the row shows on the narrowest phones, where the full name would not fit beside the amounts;
   * the start of `name`, whose rest still reaches screen readers (#1163)
   */
  shortName?: string
  /** What the slice is worth, already written, such as "$3,467" */
  amount: string
  /** Its share, as the whole number written beside it */
  percent: number
  /** Its exact share, 0 to 100: the bar draws it this wide */
  share: number
  tone: ShareTone
}

/** A slice's name: with a short form, the rest hides on the narrowest phones but stays for screen readers */
function SliceName({ name, shortName }: { name: string; shortName?: string }) {
  if (!shortName || !name.startsWith(shortName) || name === shortName) return name
  return (
    <>
      {shortName}
      <span className="max-[24rem]:sr-only">{name.slice(shortName.length)}</span>
    </>
  )
}

/** How long the total's flash lasts (`total-pulse` in the theme's `tailwind.css`, which a test holds to it) */
export const TOTAL_PULSE_MS = 300

/**
 * The receipt's one grid of three columns, which its rows and its total both take (`subgrid`), so a
 * column that widens moves them together and the amounts always line up: the name, then the percent,
 * then the dollars, flush to the right edge as on a bill, and as in the breakdown chart (#1163, #1184).
 * The dollar column is at least wide enough for
 * a four-digit amount and grows to the widest one, the total's included, so a large home's amounts
 * never run into the names; the percent column is fixed and sits just before it, and a small gap
 * keeps the two apart.
 */
const RECEIPT_COLUMNS =
  'grid grid-cols-[1fr_1.5rem_minmax(2.5rem,auto)] gap-x-1.5 min-[24rem]:grid-cols-[1fr_2rem_minmax(3.5rem,auto)] min-[24rem]:gap-x-2'

/**
 * A nested row starts where the slices' names start: past the row's side padding, the colour square
 * and the gap after it (`px-1` + `size-2` + `gap-x-1`, then `size-3` + `gap-x-2` from 24 rem), and
 * ends at the rows' own end (`px-1`)
 */
const NESTED_INDENT = 'pr-1 pl-4 min-[24rem]:pl-6'

/**
 * One whole as a bill (#1111, #1118), laid out like a receipt: its title on top, one bar whose slices are as wide as their shares,
 * and under it a receipt that names every slice with its color, dollars and percent, in the bar's
 * own order, since both are made from the same slices. The highlighted slice's row has a soft primary
 * fill and bolder text (the tone's `row`), and every row has the same side padding, so the columns
 * stay level. The receipt is one grid of three columns
 * with fixed widths for the percent and the amount, so each column lines up from row to row and
 * the block keeps its height when the amounts change. The total flashes the accent once each time
 * `pulseKey` changes, unless motion is reduced. The caller writes `label`, what the bar says to
 * screen readers. `nested` puts extra content, such as an open-and-close row about one slice, as a
 * row of its own directly under that slice's row, indented to its name (#1163).
 */
export function ShareBill({
  slices,
  label,
  title,
  titleId,
  total,
  pulseKey,
  nested,
  className,
}: {
  slices: readonly ShareSlice[]
  label: string
  /** The bill's name, at the top with no amount beside it */
  title?: string
  /** An id for the title, so a row inside the bill can keep it in view when it opens (#1178) */
  titleId?: string
  /** What the amounts add up to: the last line, as on a receipt */
  total?: { label: string; amount: string }
  /** Changes each time the total should flash once */
  pulseKey?: number
  /** Content shown as a row of its own under the slice whose key is `after` */
  nested?: { after: string; children: ReactNode }
  className?: string
}) {
  return (
    <div data-share-bill className={cn('space-y-1.5', className)}>
      {title && (
        <Text variant="subsection" as="p" id={titleId}>
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
      <div className={RECEIPT_COLUMNS}>
        <ul className="col-span-3 grid grid-cols-subgrid text-xs min-[24rem]:text-sm">
          {slices.map((slice) => (
            <React.Fragment key={slice.key}>
              <li
                data-share-row={slice.key}
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
                  {/* Never wraps; on the narrowest phone a very large amount can cut it with an ellipsis rather than overlap */}
                  <span className="truncate text-foreground" title={slice.name}>
                    <SliceName name={slice.name} shortName={slice.shortName} />
                  </span>
                </span>
                <span
                  className={cn(
                    'text-right whitespace-nowrap tabular-nums',
                    SHARE_TONES[slice.tone].row ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {slice.percent}%
                </span>
                {/* Ends at its column's end, the right edge, like the total's amount */}
                <span className="justify-self-end font-semibold whitespace-nowrap text-foreground tabular-nums">
                  {slice.amount}
                </span>
              </li>
              {nested?.after === slice.key && (
                <li className={cn('col-span-3 border-t border-border', NESTED_INDENT)}>
                  {nested.children}
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
        {total && (
          <p
            key={pulseKey}
            className={cn(
              'col-span-3 mt-1.5 grid min-h-6 grid-cols-subgrid items-center border-t-2 border-foreground pt-1 pr-1 text-sm font-bold text-foreground min-[24rem]:text-base',
              pulseKey ? 'total-pulse' : undefined,
            )}
          >
            {/* The rows' own side padding, on the label, so it starts where the names start */}
            <span className="min-w-0 truncate pl-1" title={total.label}>
              {total.label}
            </span>
            {/* Ends where the rows' dollars end, the right edge, inside the rows' own side padding (`pr-1`): the dollar column grows to the widest amount, this one included */}
            <span className="col-start-3 justify-self-end whitespace-nowrap tabular-nums">
              {total.amount}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
