import React, { useId, type ReactNode } from 'react'

import { cn } from '@/platform/lib/cn'

/** How tall the bar is, in pixels */
const BAR_HEIGHT = 48

/**
 * How far the highlighted slice's edges run down from the bar to the panel's top edge, in pixels.
 * One number for the SVG's height, the arcs and where the panel starts, so they cannot drift.
 */
export const SHARE_BAR_GAP = 10

/** The curve where the highlighted slice's edge meets the panel: half the drop, as the owner approved */
const FLARE = SHARE_BAR_GAP / 2

/** A slice's tone: three grays, strongest first, or the one highlighted slice */
const TONE_FILL = {
  strong: 'fill-muted-foreground/45',
  medium: 'fill-muted-foreground/30',
  light: 'fill-muted-foreground/18',
} as const

/** The same tones as a small square, for a key beside the bar */
const TONE_SWATCH = {
  strong: 'bg-muted-foreground/45',
  medium: 'bg-muted-foreground/30',
  light: 'bg-muted-foreground/18',
  highlight: 'bg-primary/30 border border-primary',
} as const

/** A small square in a slice's tone, for the key: decorative, the key's text names the slice */
export function ShareBarSwatch({ tone }: { tone: ShareBarSlice['tone'] }) {
  return (
    <span aria-hidden="true" className={cn('inline-block size-3 shrink-0', TONE_SWATCH[tone])} />
  )
}

export type ShareBarSlice = {
  key: string
  /** Its exact share of the whole, 0 to 100: the slice is drawn this wide */
  share: number
  tone: keyof typeof TONE_FILL | 'highlight'
  /** Written inside the slice, when the slice is wide enough to hold it */
  label?: string
}

/**
 * One whole as a bar of slices, each exactly as wide as its share (a square bar, not a pie), with
 * one slice highlighted: the same glassy green as the page's tabs, outlined, its two side edges
 * running down `SHARE_BAR_GAP` px and curving into the top edge of the panel under the bar, so the
 * slice and the panel read as one folder tab (the way `Tabs` joins a tab to its panel). The panel
 * holds `children`. Everything is one SVG, so the outline is one seamless line and a slice's width
 * is an attribute (a percent), never an inline style. The bar is one named picture for screen
 * readers; the numbers belong in text next to it, which the caller writes.
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
  const gradient = `share-bar-${useId().replace(/:/g, '')}`
  const total = slices.reduce((sum, slice) => sum + slice.share, 0) || 1
  const placed = slices.map((slice, index) => ({
    ...slice,
    share: (slice.share / total) * 100,
    start: (slices.slice(0, index).reduce((sum, earlier) => sum + earlier.share, 0) / total) * 100,
  }))
  const highlight = placed.find((slice) => slice.tone === 'highlight')
  const panelTop = BAR_HEIGHT + SHARE_BAR_GAP
  // Where the curve starts: the straight run down, then the quarter circle onto the panel's edge
  const curveTop = panelTop - FLARE
  const pct = (n: number) => `${Number(n.toFixed(3))}%`

  return (
    <div className={className}>
      <svg
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
          const separated =
            index > 0 && slice.tone !== 'highlight' && previous?.tone !== 'highlight'
          return (
            <React.Fragment key={slice.key}>
              <rect
                data-share-slice={slice.key}
                x={pct(slice.start)}
                width={pct(slice.share)}
                height={BAR_HEIGHT}
                className={slice.tone === 'highlight' ? 'fill-card' : TONE_FILL[slice.tone]}
              />
              {slice.tone === 'highlight' && (
                <rect
                  x={pct(slice.start)}
                  width={pct(slice.share)}
                  height={BAR_HEIGHT}
                  fill={`url(#${gradient})`}
                />
              )}
              {separated && (
                <rect x={pct(slice.start)} width={2} height={BAR_HEIGHT} className="fill-card" />
              )}
              {slice.label && (
                <text
                  x={pct(slice.start + slice.share / 2)}
                  y={BAR_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground text-sm font-semibold"
                >
                  {slice.label}
                </text>
              )}
            </React.Fragment>
          )
        })}
        {highlight && (
          <g data-share-outline aria-hidden="true" className="[shape-rendering:geometricPrecision]">
            {/* The gap under the slice is the panel's colour, and it covers the panel's top line */}
            <rect
              x={pct(highlight.start)}
              y={BAR_HEIGHT}
              width={pct(highlight.share)}
              height={SHARE_BAR_GAP + 1}
              className="fill-card"
            />
            <rect
              x={pct(highlight.start)}
              width={pct(highlight.share)}
              height={1}
              className="fill-primary"
            />
            {/* Left edge: down inside the slice, then the curve out onto the panel's top edge */}
            <svg x={pct(highlight.start)} overflow="visible">
              <rect width={1} height={curveTop + 1} className="fill-primary" />
              <path
                d={`M .5 ${curveTop + 0.5} A ${FLARE} ${FLARE} 0 0 1 ${0.5 - FLARE} ${panelTop + 0.5}`}
                fill="none"
                strokeWidth={1}
                className="stroke-primary"
              />
            </svg>
            <svg x={pct(highlight.start + highlight.share)} overflow="visible">
              <rect x={-1} width={1} height={curveTop + 1} className="fill-primary" />
              <path
                d={`M -.5 ${curveTop + 0.5} A ${FLARE} ${FLARE} 0 0 0 ${FLARE - 0.5} ${panelTop + 0.5}`}
                fill="none"
                strokeWidth={1}
                className="stroke-primary"
              />
            </svg>
          </g>
        )}
      </svg>
      {children !== undefined && (
        <div className={cn('rounded-2xl border border-primary bg-card p-4 sm:p-5')}>{children}</div>
      )}
    </div>
  )
}
