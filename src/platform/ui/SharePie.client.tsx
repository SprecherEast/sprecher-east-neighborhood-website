'use client'

import React from 'react'

import { cn } from '@/platform/lib/cn'
import { PIE_PERCENT_AT, pieArcs, pieAt, pieLabelFits, piePath } from '@/platform/lib/pie'

import { useElementWidth } from './useElementWidth.client'

/** The widest the pie is drawn, in pixels: wider cards leave room round it, not a bigger pie */
const MAX_PIE_PX = 460
/** The width drawn before the pie is measured (on the server, before the first paint) */
const FIRST_PAINT_PX = 400
/** Room kept for the wedges' outline at the pie's edge, in pixels */
const RIM = 2

/** A wedge's tone: three grays, lightest first, or the one highlighted wedge in the theme's green */
const TONE_FILL = {
  light: 'fill-muted-foreground/20 stroke-card',
  medium: 'fill-muted-foreground/40 stroke-card',
  dark: 'fill-muted-foreground/60 stroke-card',
  highlight: 'fill-primary/30 stroke-primary/50',
} as const

/** The same tones as a small square in the legend */
const TONE_SWATCH = {
  light: 'bg-muted-foreground/20',
  medium: 'bg-muted-foreground/40',
  dark: 'bg-muted-foreground/60',
  highlight: 'bg-primary/30 border border-primary/50',
} as const

export type SharePieSlice = {
  key: string
  name: string
  /** What the wedge is worth, already written, such as "$3,467" */
  amount: string
  /** Its share, as the whole number written on it */
  percent: number
  /** Its exact share, 0 to 100: the wedge is drawn this big */
  share: number
  tone: keyof typeof TONE_FILL
}

/**
 * One whole as a pie (#1022): a wedge for each slice, as big as its exact share, the first slice
 * starting at the top and the rest clockwise from it, with one highlighted wedge in the theme's green
 * and the others in three grays that are easy to tell apart. Each wedge writes its percent inside it
 * when that fits (a thin wedge on a small pie leaves it to the legend). The legend under the pie lists
 * every slice with its color, dollars and percent, and reads as a receipt: an optional heading on top
 * and an optional total at the bottom. Its rows keep one height, so a card holding the pie never
 * changes height when the shares do. The pie is one named picture for screen readers, whose label
 * the caller writes with every wedge's name, dollars and percent.
 */
export function SharePie({
  slices,
  label,
  heading,
  total,
  pulseKey,
  className,
}: {
  slices: readonly SharePieSlice[]
  /** What the pie shows, for screen readers */
  label: string
  /** The line above the legend's rows, such as the home the amounts are for */
  heading?: string
  /** The line under the rows: what the amounts add up to */
  total?: { label: string; amount: string }
  /** Changes each time the total should flash once (the page's accent), unless motion is reduced */
  pulseKey?: number
  className?: string
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const size = Math.min(width > 0 ? width : FIRST_PAINT_PX, MAX_PIE_PX)
  const center = size / 2
  const radius = center - RIM
  const arcs = pieArcs(slices.map((slice) => slice.share))
  // The highlighted wedge is drawn last, so its outline shows along every edge it shares
  const drawOrder = slices
    .map((slice, index) => ({ slice, index }))
    .sort((a, b) => Number(a.slice.tone === 'highlight') - Number(b.slice.tone === 'highlight'))

  return (
    <div ref={ref} className={cn('w-full', className)}>
      <svg
        role="img"
        aria-label={label}
        width={size}
        height={size}
        className="mx-auto block max-w-full"
      >
        {drawOrder.map(({ slice, index }) => {
          const arc = arcs[index]
          if (!arc || arc.end <= arc.start) return null
          return (
            <path
              key={slice.key}
              data-pie-slice={slice.key}
              d={piePath(center, center, radius, arc.start, arc.end)}
              strokeWidth={slice.tone === 'highlight' ? 1.5 : 2}
              strokeLinejoin="round"
              className={TONE_FILL[slice.tone]}
            />
          )
        })}
        {slices.map((slice, index) => {
          const arc = arcs[index]
          const text = `${slice.percent}%`
          if (!arc || !pieLabelFits({ share: slice.share, radius, text })) return null
          const at = pieAt(center, center, radius * PIE_PERCENT_AT, arc.mid)
          return (
            <text
              key={slice.key}
              data-pie-label={slice.key}
              x={at.x}
              y={at.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-base font-semibold"
            >
              {text}
            </text>
          )
        })}
      </svg>
      <div data-pie-legend className="mt-4 space-y-2 text-sm">
        {heading && (
          <p className="min-h-14 text-lg font-bold text-accent-dark sm:min-h-10">{heading}</p>
        )}
        {/* One grid for every row; the percent and amount columns have fixed widths, so a longer amount never narrows the names and changes how they wrap */}
        <ul className="grid grid-cols-[1fr_2.75rem_5.5rem] gap-x-2">
          {slices.map((slice) => (
            <li
              key={slice.key}
              className="col-span-3 grid min-h-10 grid-cols-subgrid items-center border-t border-border py-1 first:border-t-0"
            >
              <span className="flex min-w-0 items-center gap-x-2">
                <span
                  aria-hidden="true"
                  className={cn('inline-block size-3 shrink-0', TONE_SWATCH[slice.tone])}
                />
                <span
                  data-legend-name
                  className={cn('text-foreground', slice.tone === 'highlight' && 'font-bold')}
                >
                  {slice.name}
                </span>
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
        {total && (
          <p
            key={pulseKey}
            className={cn(
              'flex min-h-10 items-center justify-between gap-x-2 border-t-2 border-foreground/30 font-semibold text-foreground',
              pulseKey ? 'total-pulse' : undefined,
            )}
          >
            <span>{total.label}</span>
            <span className="tabular-nums">{total.amount}</span>
          </p>
        )}
      </div>
    </div>
  )
}
