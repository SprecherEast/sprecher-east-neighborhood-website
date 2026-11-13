import React from 'react'

import { cn } from '@/platform/lib/cn'
import {
  formatShare,
  formatSquareValue,
  type BreakdownModel,
  type BreakdownPiece,
} from '@/platform/lib/chart/breakdown'
import { Disclosure } from '@/platform/ui/Disclosure'
import { Text } from '@/platform/ui/Text'

import { rampAt } from '../../chartPalette'

import { Amount } from './Amount'

/** The key's heading, also the name of its list */
const KEY_TITLE = 'Where the money goes'

type RowProps = {
  piece: BreakdownPiece
  /** Set under its area (`nested`) or in the smaller list (`flat`) */
  nested?: 'area' | 'flat'
  /** "in Everything else", for a piece in the smaller list */
  area?: string
  scale: number
  look: BarLook
}

/**
 * How the bars are drawn: `compact` makes them thinner, for a breakdown inside a bill; `fill` grows
 * them over time when drawn (a row opening) instead of as they scroll into view (#1163)
 */
type BarLook = { compact: boolean; fill: boolean }

/** One bar: its length is the share times the shared scale, so a dollar is the same length in every breakdown */
function Bar({
  piece,
  nested,
  scale,
  look,
}: {
  piece: BreakdownPiece
  nested: boolean
  scale: number
  look: BarLook
}) {
  const ramp = rampAt(piece.step)
  const height = look.compact ? (nested ? 'h-1.5' : 'h-2.5') : nested ? 'h-2' : 'h-3.5'
  const radius = look.compact ? (nested ? 3 : 5) : nested ? 4 : 7
  return (
    <svg aria-hidden="true" focusable="false" className={cn('block w-full', height)}>
      <rect width="100%" height="100%" rx={radius} className="fill-muted" />
      <g className={look.fill ? 'chart-fill-x' : 'chart-reveal-x'}>
        <rect
          data-chart-mark={piece.key}
          width={`${(piece.share * scale).toFixed(2)}%`}
          height="100%"
          rx={radius}
          className={cn(ramp.fill, 'stroke-chart-ramp-edge')}
          strokeWidth={2}
        />
      </g>
    </svg>
  )
}

/** A label, a bar, the dollars and the percent: on a phone the bar drops under the label */
function BarRow({ piece, nested, area, scale, look }: RowProps) {
  const ramp = rampAt(piece.step)
  return (
    <li
      data-breakdown-row={piece.key}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 py-1.5 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4.5rem_3rem]',
        nested && 'ml-1 border-l-2 pl-2.5 sm:ml-2.5 sm:pl-3.5',
        nested === 'area' && ramp.border,
        nested === 'flat' && 'border-border',
      )}
    >
      <span data-label className="min-w-0">
        <Text
          variant="small"
          as="span"
          className={cn('block', nested ? 'text-sm' : 'text-foreground')}
        >
          {piece.label}
        </Text>
        {area && (
          <Text variant="small" as="span" className="block text-xs">
            in {area}
          </Text>
        )}
      </span>
      <span className="order-last col-span-full row-start-2 sm:order-none sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <Bar piece={piece} nested={Boolean(nested)} scale={scale} look={look} />
      </span>
      <Text
        variant="small"
        as="span"
        className={cn(
          'text-right tabular-nums',
          nested ? 'font-medium' : 'font-semibold text-foreground',
        )}
      >
        <span data-amount>
          <Amount piece={piece} />
        </span>
      </Text>
      <Text variant="small" as="span" className="text-right tabular-nums">
        {formatShare(piece.share)}
      </Text>
    </li>
  )
}

type Props = {
  model: BreakdownModel
  squareValue: number
  titleId: string
  descId: string
  /** Thinner bars, for a breakdown inside a bill (#1163) */
  compact?: boolean
  /** Grow the bars when drawn rather than on scroll (#1163) */
  fill?: boolean
}

/**
 * A breakdown (#866): a grid of squares worth a fixed amount each, the key beside it in dollars
 * (both left out when the chart hides its squares), then ranked bars with the areas' main pieces nested under them, and the other pieces in one
 * list biggest first. Colour follows size down the page, from orange to green to gray. Only the
 * grid is an image; the key and the bars are text, so a screen reader reads every figure.
 */
export function BreakdownChart({
  model,
  squareValue,
  titleId,
  descId,
  compact = false,
  fill = false,
}: Props) {
  const { areas, smaller, barScale, showSquares } = model
  const look = { compact, fill }
  return (
    <div className="space-y-5">
      {showSquares && (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div
              role="img"
              aria-labelledby={`${titleId} ${descId}`}
              className="grid w-50 shrink-0 chart-reveal grid-cols-10 gap-[3px]"
            >
              {areas.flatMap((area) =>
                Array.from({ length: area.squares }, (_, index) => (
                  <span
                    key={`${area.key}-${index}`}
                    data-chart-mark={area.key}
                    className={cn(
                      'aspect-square rounded-[3px] ramp-edge print-exact',
                      rampAt(area.step).bg,
                    )}
                  />
                )),
              )}
            </div>
            <div className="w-full min-w-0 space-y-1.5">
              <Text variant="small" as="p" className="font-semibold text-foreground">
                {KEY_TITLE}:
              </Text>
              <ul role="list" aria-label={KEY_TITLE} className="space-y-1.5">
                {areas.map((area) => (
                  <li
                    key={area.key}
                    className="grid grid-cols-[0.875rem_1fr_auto] items-center gap-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-3.5 rounded-[3px] ramp-edge print-exact',
                        rampAt(area.step).bg,
                      )}
                    />
                    <Text variant="small" as="span" className="text-foreground">
                      {area.label}
                    </Text>
                    <Text
                      variant="small"
                      as="span"
                      className="font-semibold text-foreground tabular-nums"
                    >
                      <Amount piece={area} />
                    </Text>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn('size-3.5 shrink-0 rounded-[3px] ramp-edge print-exact', rampAt(3).bg)}
            />
            <Text variant="small" as="span">
              <span className="font-semibold text-foreground">
                = {formatSquareValue(squareValue)}
              </span>{' '}
              each. Rounded to whole squares.
            </Text>
          </p>
        </div>
      )}
      <ul role="list">
        {areas.map((area) => (
          <React.Fragment key={area.key}>
            <BarRow piece={area} scale={barScale} look={look} />
            {area.shown.map((piece) => (
              <BarRow key={piece.key} piece={piece} nested="area" scale={barScale} look={look} />
            ))}
          </React.Fragment>
        ))}
      </ul>
      {smaller.length > 0 && (
        <Disclosure variant="link" summary="See the smaller pieces">
          <ul role="list">
            {smaller.map((piece) => (
              <BarRow
                key={piece.key}
                piece={piece}
                nested="flat"
                area={piece.area}
                scale={barScale}
                look={look}
              />
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  )
}
