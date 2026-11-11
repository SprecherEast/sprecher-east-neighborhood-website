'use client'

import React, { useId, type ReactNode } from 'react'

import { cn } from '@/platform/lib/cn'

import { ShareBarEdge } from './ShareBarEdge'
import { useElementWidth } from './useElementWidth.client'

/** How tall the bar is, in pixels */
const BAR_HEIGHT = 48

/**
 * How far the highlighted slice's edges run down from the bar to the panel's top edge, in pixels.
 * One number for the SVG's height, the arcs and where the panel starts, so they cannot drift.
 */
export const SHARE_BAR_GAP = 10

/** How far the highlighted slice stands above the others, in pixels: the folder tab's step */
export const SHARE_BAR_RISE = 5

/** A slice this wide, in percent, or wider has room for its label inside it */
export const SHARE_BAR_INSIDE_MIN = 8

/** The curve where the highlighted slice's edge meets the panel: half the drop, as the owner approved */
const FLARE = SHARE_BAR_GAP / 2

/**
 * The row above the bar that holds the label of a slice too narrow to hold its own. Most of it is
 * drawn in the gap the page leaves above the bar (`-mt-5` on the root), so a bar with such a label
 * sits as far from what is above it as one without.
 */
const LABEL_ROW = 22

/** A slice's tone: three grays, strongest first, or the one highlighted slice */
const TONE_FILL = {
  strong: 'fill-muted-foreground/45',
  medium: 'fill-muted-foreground/30',
  light: 'fill-muted-foreground/18',
} as const

export type ShareBarSlice = {
  key: string
  /** Its exact share of the whole, 0 to 100: the slice is drawn this wide */
  share: number
  tone: keyof typeof TONE_FILL | 'highlight'
  /** Written on the slice: inside it, or above it when the slice is too narrow to hold it */
  label?: string
  /** A short name written above the label inside the slice (the label stays alone above a slice too narrow for it) */
  name?: string
}

/**
 * One whole as a bar of slices, each exactly as wide as its share (a square bar, not a pie), with
 * one slice highlighted: the same glassy green as the page's tabs, outlined, standing `SHARE_BAR_RISE`
 * px above the others, its two side edges running down `SHARE_BAR_GAP` px and curving into the top
 * edge of the panel under the bar, so the slice and the panel read as one folder tab (the way `Tabs`
 * joins a tab to its panel). The panel holds `children`. Everything is one SVG, so a slice's width is
 * an attribute, never an inline style. Once the bar knows its width every edge is moved to a whole
 * pixel, so the lines and curves stay crisp and join cleanly at any screen width; until then
 * (on the server, before the first paint) it draws in percent. A slice too narrow for its label
 * gets the label above it with a tick. The bar is one named picture for screen readers; the numbers
 * belong in text next to it, which the caller writes.
 */
export function ShareBar({
  slices,
  label,
  children,
  className,
}: {
  slices: readonly ShareBarSlice[]
  /** What the bar shows, for screen readers */
  label: string
  /** The panel under the bar */
  children?: ReactNode
  className?: string
}) {
  const [ref, width] = useElementWidth<SVGSVGElement>()
  const gradient = `share-bar-${useId().replace(/:/g, '')}`
  const total = slices.reduce((sum, slice) => sum + slice.share, 0) || 1
  const placed = slices.map((slice, index) => {
    const start =
      (slices.slice(0, index).reduce((sum, earlier) => sum + earlier.share, 0) / total) * 100
    const share = (slice.share / total) * 100
    return { ...slice, share, start, end: start + share }
  })
  const highlight = placed.find((slice) => slice.tone === 'highlight')
  const narrow = placed.filter((slice) => slice.label && slice.share < SHARE_BAR_INSIDE_MIN)
  const lift = narrow.length > 0 ? LABEL_ROW : 0
  const barTop = lift + (highlight ? SHARE_BAR_RISE : 0)
  const panelTop = barTop + BAR_HEIGHT + SHARE_BAR_GAP
  const measured = width > 0

  /** A position along the bar: a whole pixel once measured, otherwise a percent */
  const at = (percent: number): number | string =>
    measured ? Math.round((percent * width) / 100) : `${Number(percent.toFixed(3))}%`
  /** The same position as a number of pixels, for where text and ticks go (percent until measured) */
  const span = (from: number, to: number): number | string =>
    measured ? Number(at(to)) - Number(at(from)) : `${Number((to - from).toFixed(3))}%`
  const middle = (slice: { start: number; end: number }) => at((slice.start + slice.end) / 2)

  return (
    <div className={cn(narrow.length > 0 && '-mt-5', className)}>
      <svg
        ref={ref}
        role="img"
        aria-label={label}
        height={panelTop}
        className="relative z-10 block w-full overflow-visible"
      >
        {highlight && (
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopOpacity="0.3" className="[stop-color:var(--color-primary)]" />
            <stop offset="1" stopOpacity="0" className="[stop-color:var(--color-primary)]" />
          </linearGradient>
        )}
        {placed.map((slice, index) => {
          const previous = placed[index - 1]
          const isHighlight = slice.tone === 'highlight'
          const separated = index > 0 && !isHighlight && previous?.tone !== 'highlight'
          const top = isHighlight ? lift : barTop
          const height = isHighlight ? barTop + BAR_HEIGHT - lift : BAR_HEIGHT
          const outside = Boolean(slice.label) && slice.share < SHARE_BAR_INSIDE_MIN
          return (
            <React.Fragment key={slice.key}>
              <rect
                data-share-slice={slice.key}
                x={at(slice.start)}
                y={top}
                width={span(slice.start, slice.end)}
                height={height}
                className={
                  isHighlight ? 'fill-card' : TONE_FILL[slice.tone as keyof typeof TONE_FILL]
                }
              />
              {isHighlight && (
                <rect
                  x={at(slice.start)}
                  y={top}
                  width={span(slice.start, slice.end)}
                  height={height}
                  fill={`url(#${gradient})`}
                />
              )}
              {separated && (
                <rect
                  x={at(slice.start)}
                  y={barTop}
                  width={2}
                  height={BAR_HEIGHT}
                  className="fill-card"
                />
              )}
              {slice.label && !outside && (
                <text
                  x={middle(slice)}
                  y={barTop + BAR_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground text-sm font-semibold"
                >
                  {slice.name ? (
                    <>
                      <tspan x={middle(slice)} dy="-0.6em">
                        {slice.name}
                      </tspan>
                      <tspan x={middle(slice)} dy="1.2em">
                        {slice.label}
                      </tspan>
                    </>
                  ) : (
                    slice.label
                  )}
                </text>
              )}
              {slice.label && outside && (
                <>
                  <text
                    data-share-label-outside=""
                    x={at(slice.end)}
                    y={LABEL_ROW / 2 - 2}
                    textAnchor="end"
                    dominantBaseline="central"
                    className="fill-foreground text-xs font-semibold"
                  >
                    {slice.label}
                  </text>
                  <line
                    data-share-tick=""
                    x1={middle(slice)}
                    x2={middle(slice)}
                    y1={LABEL_ROW - 6}
                    y2={isHighlight ? lift : barTop}
                    strokeWidth={1}
                    className="stroke-muted-foreground"
                  />
                </>
              )}
            </React.Fragment>
          )
        })}
        {highlight && (
          <g data-share-outline aria-hidden="true">
            {/* The gap under the slice is the panel's colour, and it covers the panel's top line */}
            <rect
              x={at(highlight.start)}
              y={barTop + BAR_HEIGHT}
              width={span(highlight.start, highlight.end)}
              height={SHARE_BAR_GAP + 1}
              className="fill-card"
            />
            <rect
              x={at(highlight.start)}
              y={lift}
              width={span(highlight.start, highlight.end)}
              height={1}
              className="fill-primary"
            />
            <ShareBarEdge
              x={at(highlight.start)}
              side="left"
              top={lift}
              panelTop={panelTop}
              flare={FLARE}
            />
            <ShareBarEdge
              x={at(highlight.end)}
              side="right"
              top={lift}
              panelTop={panelTop}
              flare={FLARE}
            />
          </g>
        )}
      </svg>
      {children !== undefined && (
        <div className="rounded-2xl border border-primary bg-card p-4 sm:p-5">{children}</div>
      )}
    </div>
  )
}
