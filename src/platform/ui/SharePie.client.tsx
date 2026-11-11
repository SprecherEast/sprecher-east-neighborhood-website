'use client'

import React from 'react'

import { cn } from '@/platform/lib/cn'
import {
  PIE_FONT_PX,
  PIE_FULL_AT,
  PIE_PERCENT_AT,
  pieArcs,
  pieAt,
  pieLabelFit,
  piePath,
} from '@/platform/lib/pie'

import { useElementWidth } from './useElementWidth.client'

/** The widest the pie is drawn, in pixels: wider cards leave room round it, not a bigger pie */
const MAX_PIE_PX = 460
/** The width drawn before the pie is measured (on the server, before the first paint) */
const FIRST_PAINT_PX = 400
/** Room kept for the wedges' outline at the pie's edge, in pixels */
const RIM = 2
/** Line height of the label text inside a wedge, in pixels */
const LINE_PX = PIE_FONT_PX * 1.3

/** A wedge's tone: three grays, lightest first, or the one highlighted wedge in the theme's green */
const TONE_FILL = {
  light: 'fill-muted-foreground/20 stroke-card',
  medium: 'fill-muted-foreground/40 stroke-card',
  dark: 'fill-muted-foreground/60 stroke-card',
  highlight: 'fill-primary/30 stroke-primary',
} as const

/** The same tones as a small square in the legend */
const TONE_SWATCH = {
  light: 'bg-muted-foreground/20',
  medium: 'bg-muted-foreground/40',
  dark: 'bg-muted-foreground/60',
  highlight: 'bg-primary/30 border border-primary',
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
 * One whole as a pie (#1022): a wedge for each slice, as big as its exact share, clockwise from the
 * top, with one highlighted wedge in the theme's green and the others in three grays that are easy
 * to tell apart. Each wedge writes its name, dollars and percent inside it when they fit, only its
 * percent when just that fits, and nothing when not even that fits; the legend under the pie then
 * lists every wedge that was not written in full. The pie draws from its own width, so the same wedge
 * can fit inside on a wide screen and be left to the legend on a phone. The legend's room is always
 * kept, so a card that holds the pie never changes height when the shares do. The pie is one named
 * picture for screen readers; the numbers belong in text next to it, which the caller writes.
 */
export function SharePie({
  slices,
  label,
  className,
}: {
  slices: readonly SharePieSlice[]
  /** What the pie shows, for screen readers */
  label: string
  className?: string
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const size = Math.min(width > 0 ? width : FIRST_PAINT_PX, MAX_PIE_PX)
  const center = size / 2
  const radius = center - RIM
  const arcs = pieArcs(slices.map((slice) => slice.share))
  const fits = slices.map((slice) =>
    pieLabelFit({
      share: slice.share,
      radius,
      lines: [slice.name, slice.amount, `${slice.percent}%`],
    }),
  )

  return (
    <div ref={ref} className={cn('w-full', className)}>
      <svg
        role="img"
        aria-label={label}
        width={size}
        height={size}
        className="mx-auto block max-w-full"
      >
        {slices.map((slice, index) => {
          const arc = arcs[index]
          if (!arc || arc.end <= arc.start) return null
          return (
            <path
              key={slice.key}
              data-pie-slice={slice.key}
              d={piePath(center, center, radius, arc.start, arc.end)}
              strokeWidth={2}
              strokeLinejoin="round"
              className={TONE_FILL[slice.tone]}
            />
          )
        })}
        {slices.map((slice, index) => {
          const arc = arcs[index]
          const fit = fits[index]
          if (!arc || fit === 'out' || fit === undefined) return null
          const lines =
            fit === 'full' ? [slice.name, slice.amount, `${slice.percent}%`] : [`${slice.percent}%`]
          const at = pieAt(
            center,
            center,
            radius * (fit === 'full' ? PIE_FULL_AT : PIE_PERCENT_AT),
            arc.mid,
          )
          return (
            <text
              key={slice.key}
              data-pie-label={slice.key}
              x={at.x}
              y={at.y - ((lines.length - 1) * LINE_PX) / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-xs"
            >
              {lines.map((line, lineIndex) => (
                <tspan
                  key={line}
                  x={at.x}
                  dy={lineIndex === 0 ? 0 : LINE_PX}
                  className={lineIndex === lines.length - 1 ? 'font-semibold' : undefined}
                >
                  {line}
                </tspan>
              ))}
            </text>
          )
        })}
      </svg>
      <ul data-pie-legend className="mt-3 min-h-18 space-y-1 text-sm">
        {slices.map((slice, index) =>
          fits[index] === 'full' ? null : (
            <li key={slice.key} className="flex flex-wrap items-center gap-x-2">
              <span
                aria-hidden="true"
                className={cn('inline-block size-3 shrink-0', TONE_SWATCH[slice.tone])}
              />
              <span className="text-foreground">{slice.name}</span>
              <span className="font-semibold text-foreground">{slice.amount}</span>
              <span className="text-muted-foreground">about {slice.percent}%</span>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
