import React, { type ReactNode } from 'react'

import { cn } from '@/platform/lib/cn'

import { BarTrack } from './BarTrack'
import { Text } from './Text'
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
 * A nested row (an open-and-close row about one slice) sits under that slice's row, set in from the
 * left and marked by a line in the slice's own color, so it reads as part of the slice and not as
 * one more body (#1196).
 */
const NESTED_INDENT = 'ml-1 border-l-2 pr-1 pl-2 sm:ml-4 sm:pl-3'

/**
 * What a nested row sets on the right of its own amounts: about the width of the dollar column, so
 * they end before the bodies' amounts and never line up with them, as a ledger sets off "of which"
 * lines: nobody adds them to the bill. The row's button keeps its full width; only the amounts move (#1196).
 */
export const NESTED_AMOUNTS_INSET = 'mr-6 sm:mr-12'

/** One slice's bar: its length is its share of the largest slice's, so every bar shares one scale (#1196) */
function SliceBar({ slice, scale }: { slice: ShareSlice; scale: number }) {
  return (
    <BarTrack
      width={slice.share * scale}
      radius={5}
      className="col-span-3 mt-1.5 h-2.5"
      fillClassName={SHARE_TONES[slice.tone].fill}
      mark={{ 'data-share-bar': slice.key }}
    />
  )
}

/**
 * One whole as a bill (#1111, #1118), laid out like a receipt: its title on top, then one row for every
 * slice with its name, percent and dollars and, under them, its own bar in the slice's color, drawn like the
 * City breakdown's (#1196). The bars share one scale, the largest slice's, and every row is built the
 * same way, so the rows and bars sit level. The receipt is one grid of three columns
 * with fixed widths for the percent and the amount, so each column lines up from row to row and
 * the block keeps its height when the amounts change. The total flashes the accent once each time
 * `pulseKey` changes, unless motion is reduced. The caller writes `label`, the name the list has for
 * screen readers (the list's name). `nested` puts extra content, such as an open-and-close row about one slice, as a
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
  const scale = 100 / Math.max(...slices.map((slice) => slice.share), 1)
  return (
    <div data-share-bill className={cn('space-y-1.5', className)}>
      {title && (
        <Text variant="subsection" as="p" id={titleId}>
          {title}
        </Text>
      )}
      <div className={RECEIPT_COLUMNS}>
        <ul
          aria-label={label}
          className="col-span-3 grid grid-cols-subgrid text-xs min-[24rem]:text-sm"
        >
          {slices.map((slice) => (
            <React.Fragment key={slice.key}>
              <li
                data-share-row={slice.key}
                className="col-span-3 grid min-h-5 grid-cols-subgrid items-center px-1 pt-3 first:pt-1"
              >
                {/* Never wraps; on the narrowest phone a very large amount can cut it with an ellipsis rather than overlap */}
                <span className="min-w-0 truncate text-foreground" title={slice.name}>
                  <SliceName name={slice.name} shortName={slice.shortName} />
                </span>
                <span className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {slice.percent}%
                </span>
                {/* Ends at its column's end, the right edge, like the total's amount */}
                <span className="justify-self-end font-semibold whitespace-nowrap text-foreground tabular-nums">
                  {slice.amount}
                </span>
                <SliceBar slice={slice} scale={scale} />
              </li>
              {nested?.after === slice.key && (
                <li className={cn('col-span-3 mt-2', NESTED_INDENT, SHARE_TONES[slice.tone].edge)}>
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
