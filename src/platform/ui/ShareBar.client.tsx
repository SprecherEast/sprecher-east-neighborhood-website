'use client'

import React, { useId, useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/platform/lib/cn'

import { widenToFit } from './shareBarWidths'
import { SHARE_TONES, type ShareTone } from './shareTones'

/** How tall the bar is, in pixels */
const BAR_HEIGHT = 28

/** The rounding of the bar's ends */
const RADIUS = 8

/** The room kept on each side of a label inside its slice, in pixels */
const LABEL_PAD_PX = 8

/*
 * Until the bar has been measured (on the server, and for the first paint) a label is guessed to
 * be this wide a character, in a bar this wide, so a slice is never drawn narrower than its label
 * even without scripting. Wider than a real digit, so the guess errs on the roomy side.
 */
const GUESS_CHAR_PX = 9
const GUESS_BAR_PX = 240

export type ShareBarSlice = {
  key: string
  /** Its exact share of the whole, 0 to 100: the slice is drawn this wide, or wider when its label needs more */
  share: number
  tone: ShareTone
  /** Written inside the slice, which is drawn at least wide enough for it */
  label?: string
}

const sameMeasures = (a: Record<string, number> | null, b: Record<string, number>) =>
  a !== null &&
  Object.keys(b).length === Object.keys(a).length &&
  Object.entries(b).every(([key, value]) => Math.abs((a[key] ?? -1) - value) < 0.01)

/**
 * One whole as a flat bar of slices (#1018, #1111, #1121), in the order given, with the tones of
 * `shareTones.ts`. It is one SVG whose widths are percent attributes, never inline styles. Each
 * slice is as wide as its share and writes its label in it, in the tone's own label color (4.5:1 on
 * its fill). A slice too narrow for its label is drawn at the least width that fits it, the extra
 * taken from the other slices in proportion (`widenToFit`), so every label is read; the caller's
 * receipt keeps the exact figures. Once on the page the bar measures its labels and its own width
 * and keeps doing so as either changes; before that, and with scripting off, it guesses the
 * labels' width. Every slice is also named in text by the caller, so no slice is told by its color
 * alone. The bar is one named picture for screen readers whose `label` the caller writes.
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
  const svg = useRef<SVGSVGElement>(null)
  // The least width, in percent of the bar, each labelled slice needs, by key, once measured
  const [measured, setMeasured] = useState<Record<string, number> | null>(null)
  const written = slices.map((slice) => `${slice.key}:${slice.label ?? ''}`).join('|')

  useLayoutEffect(() => {
    const element = svg.current
    if (!element) return
    const measure = () => {
      const width = element.getBoundingClientRect().width
      const texts = Array.from(element.querySelectorAll<SVGTextElement>('text[data-share-label]'))
      // Without layout (no width, or a browser with no text measure) the guess stands
      if (width <= 0 || texts.some((text) => typeof text.getComputedTextLength !== 'function'))
        return
      const next = Object.fromEntries(
        texts.map((text) => [
          text.getAttribute('data-share-label') ?? '',
          ((text.getComputedTextLength() + 2 * LABEL_PAD_PX) / width) * 100,
        ]),
      )
      setMeasured((current) => (sameMeasures(current, next) ? current : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [written])

  const widths = widenToFit(
    slices.map((slice) => slice.share),
    slices.map((slice) => {
      if (!slice.label) return 0
      const guess = ((slice.label.length * GUESS_CHAR_PX + 2 * LABEL_PAD_PX) / GUESS_BAR_PX) * 100
      return measured?.[slice.key] ?? guess
    }),
  )
  const pct = (n: number) => `${Number(n.toFixed(3))}%`
  const placed = slices.map((slice, index) => {
    const share = widths[index] ?? 0
    const start = widths.slice(0, index).reduce((sum, earlier) => sum + earlier, 0)
    return { ...slice, share, start }
  })

  return (
    <svg
      ref={svg}
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
          slice.label && (
            <text
              key={slice.key}
              data-share-label={slice.key}
              x={pct(slice.start + slice.share / 2)}
              y={BAR_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="central"
              className={cn('text-sm font-semibold', SHARE_TONES[slice.tone].label)}
            >
              {slice.label}
            </text>
          ),
      )}
    </svg>
  )
}
