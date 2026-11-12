import React, { useId } from 'react'

import { cn } from '@/platform/lib/cn'

import { SHARE_TONES, type ShareTone } from './shareTones'

/** How tall the bar is, in pixels */
const BAR_HEIGHT = 28

/** A slice this wide, in percent, or wider has room for its label inside it */
export const SHARE_BAR_INSIDE_MIN = 8

/** The rounding of the bar's ends */
const RADIUS = 8

export type ShareBarSlice = {
  key: string
  /** Its exact share of the whole, 0 to 100: the slice is drawn this wide */
  share: number
  tone: ShareTone
  /** Written inside the slice when it is wide enough; a narrower slice leaves it to the text beside the bar */
  label?: string
}

/**
 * One whole as a flat bar of slices (#1018, #1111), each exactly as wide as its share, in the
 * order given, with the tones of `shareTones.ts`. It is one SVG whose widths are percent
 * attributes, never inline styles, so it needs no measuring and draws the same on the server. A
 * slice wide enough (`SHARE_BAR_INSIDE_MIN`) writes its label in it; every slice is named in text
 * by the caller, so no slice is told by its color alone. The bar is one named picture for screen
 * readers whose `label` the caller writes.
 */
export function ShareBar({
  slices,
  label,
  className,
}: {
  slices: readonly ShareBarSlice[]
  /** What the bar shows, for screen readers */
  label: string
  className?: string
}) {
  const clip = `share-bar-${useId().replace(/:/g, '')}`
  const total = slices.reduce((sum, slice) => sum + slice.share, 0) || 1
  const pct = (n: number) => `${Number(n.toFixed(3))}%`
  const placed = slices.map((slice, index) => {
    const start =
      (slices.slice(0, index).reduce((sum, earlier) => sum + earlier.share, 0) / total) * 100
    const share = (slice.share / total) * 100
    return { ...slice, share, start }
  })

  return (
    <svg
      role="img"
      aria-label={label}
      height={BAR_HEIGHT}
      className={cn('block w-full print-exact', className)}
    >
      <defs>
        <clipPath id={clip}>
          <rect width="100%" height={BAR_HEIGHT} rx={RADIUS} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {placed.map((slice) => (
          <rect
            key={slice.key}
            data-share-slice={slice.key}
            x={pct(slice.start)}
            width={pct(slice.share)}
            height={BAR_HEIGHT}
            strokeWidth={2}
            className={cn('stroke-card', SHARE_TONES[slice.tone].fill)}
          />
        ))}
      </g>
      {placed.map(
        (slice) =>
          slice.label &&
          slice.share >= SHARE_BAR_INSIDE_MIN && (
            <text
              key={slice.key}
              x={pct(slice.start + slice.share / 2)}
              y={BAR_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-sm font-semibold"
            >
              {slice.label}
            </text>
          ),
      )}
    </svg>
  )
}
