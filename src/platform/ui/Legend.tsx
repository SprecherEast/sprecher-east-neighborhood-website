import React from 'react'

import { cn } from '@/platform/lib/cn'

import { LEGEND_HANG, LEGEND_TUCK } from './layoutSizes'

/** One marker's entry: a short bold label and an optional line of text. */
export type LegendItem = {
  label: string
  text: string | null
}

/** A chart colour: the slot's number, 1 to 6, picks `chart-1` to `chart-6` (#661) */
export type LegendSlot = 1 | 2 | 3 | 4 | 5 | 6

/**
 * One swatch's entry (#662): its label and text, the chart colour of its slot and, where the chart
 * marks it that way, the hatch pattern, so colour is never the only cue.
 */
export type LegendSwatchItem = LegendItem & {
  slot: LegendSlot
  pattern?: 'hatch'
}

type LegendCommon = {
  /** What assistive technology calls the list, such as "Diagram key"; "Legend" by default */
  label?: string
  /**
   * `drawer` (the default) hangs from the image block above it; `none` is a plain list, such as
   * under a chart.
   */
  attach?: 'drawer' | 'none'
  className?: string
}

export type LegendProps = LegendCommon &
  (
    | {
        /** Numbered orange circles, for an annotated image; the default */
        marker?: 'number'
        items: LegendItem[]
      }
    | {
        /** The chart colour (and pattern) of each item, for a chart */
        marker: 'swatch'
        items: LegendSwatchItem[]
      }
  )

/** Written out in full so Tailwind finds each class */
const SWATCH_COLOUR: Record<LegendSlot, string> = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
  6: 'bg-chart-6',
}

const LIST_CLASSES = 'grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2'

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
 *
 * Under a chart (#662), `marker="swatch"` draws each item's chart colour instead, with the hatch
 * where the item has one, and `attach="none"` leaves out the drawer. The swatch is a second cue
 * beside the label, which is always text.
 */
export function Legend(props: LegendProps) {
  const { label = 'Legend', attach = 'drawer', className } = props
  if (props.items.length === 0) return null
  // One entry per item: its marker, and the hidden prefix a screen reader hears before the label
  const entries =
    props.marker === 'swatch'
      ? props.items.map((item) => ({
          item,
          marker: <Swatch slot={item.slot} pattern={item.pattern} />,
          prefix: null,
        }))
      : props.items.map((item, index) => ({
          item,
          marker: <NumberMarker number={index + 1} />,
          prefix: `Marker ${index + 1}: `,
        }))
  const List = props.marker === 'swatch' ? 'ul' : 'ol'
  return (
    <div
      className={cn(
        'not-prose',
        attach === 'drawer' && [
          'relative z-0 mx-4 mb-10 rounded-b-2xl border border-t-0 border-border bg-surface px-4 pb-4 shadow-sm md:mx-8 md:px-6 md:pb-6',
          LEGEND_HANG,
          LEGEND_TUCK,
        ],
        className,
      )}
    >
      {/* `role="list"`: Safari drops list semantics from a list without bullets */}
      <List role="list" aria-label={label} className={LIST_CLASSES}>
        {entries.map(({ item, marker, prefix }, index) => (
          <li key={`${index}-${item.label}`} className="flex items-start gap-3">
            {marker}
            <LegendText item={item} prefix={prefix} />
          </li>
        ))}
      </List>
    </div>
  )
}

function NumberMarker({ number }: { number: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground ring-2 ring-background"
    >
      {number}
    </span>
  )
}

function Swatch({ slot, pattern }: Pick<LegendSwatchItem, 'slot' | 'pattern'>) {
  return (
    <span
      aria-hidden="true"
      data-legend-swatch=""
      className={cn(
        'mt-1 size-5 shrink-0 rounded-sm ring-1 ring-foreground/30',
        SWATCH_COLOUR[slot],
        pattern === 'hatch' && 'bg-hatch',
      )}
    />
  )
}

function LegendText({ item, prefix }: { item: LegendItem; prefix: string | null }) {
  return (
    <p className="pt-0.5 text-base leading-snug text-foreground">
      {prefix && <span className="sr-only">{prefix}</span>}
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
  )
}
