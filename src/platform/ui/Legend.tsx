import React from 'react'

import { cn } from '@/platform/lib/cn'

import { LEGEND_HANG, LEGEND_TUCK } from './layoutSizes'

/** One marker's entry: a short bold label and an optional line of text. */
export type LegendItem = {
  label: string
  text: string | null
}

export type LegendProps = {
  items: LegendItem[]
  /** What assistive technology calls the list, such as "Diagram key"; "Legend" by default */
  label?: string
  className?: string
}

/**
 * The legend under an annotated image or a chart (#636, from the diagram key of #515): one numbered
 * circle in the accent colour per marker, the orange the site's diagrams use, each with a bold
 * label and a short line.
 *
 * It looks like a drawer that slid out from under the image: its square top is hidden beneath the
 * image block above (which stacks over it), its bottom corners are rounded, and it is inset on both
 * sides so it never meets the image's own rounded corners. A small shadow and a border (a shadow
 * barely shows in dark mode) lift it. It is still: no animation. Put it directly after the image
 * block; the sizes it shares with that block are in `layoutSizes.ts`.
 *
 * The circles are decoration; screen readers hear "Marker 2: Westbound entrance loop" from a hidden
 * prefix.
 */
export function Legend({ items, label = 'Legend', className }: LegendProps) {
  if (items.length === 0) return null
  return (
    <div
      className={cn(
        'not-prose relative z-0 mx-4 mb-10 rounded-b-2xl border border-t-0 border-border bg-surface px-4 pb-4 shadow-sm md:mx-8 md:px-6 md:pb-6',
        LEGEND_HANG,
        LEGEND_TUCK,
        className,
      )}
    >
      {/* `role="list"`: Safari drops list semantics from a list without bullets */}
      <ol
        role="list"
        aria-label={label}
        className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2"
      >
        {items.map((item, index) => (
          <LegendEntry key={`${index}-${item.label}`} item={item} number={index + 1} />
        ))}
      </ol>
    </div>
  )
}

function LegendEntry({ item, number }: { item: LegendItem; number: number }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground ring-2 ring-background"
      >
        {number}
      </span>
      <p className="pt-0.5 text-base leading-snug text-foreground">
        <span className="sr-only">Marker {number}: </span>
        {item.label && <span className="font-semibold">{item.label}</span>}
        {/* The dot stays on the label's line (no-break space before it); screen readers hear a
            colon instead of "middle dot" */}
        {item.label && item.text && (
          <>
            <span className="sr-only">: </span>
            <span aria-hidden="true" className="text-muted-foreground">
              {' · '}
            </span>
          </>
        )}
        {item.text}
      </p>
    </li>
  )
}
