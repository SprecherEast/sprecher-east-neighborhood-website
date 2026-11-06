import React from 'react'

import { cn } from '@/platform/lib/cn'

import { LEGEND_GAP } from './layoutSizes'

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
   * `panel` (the default) is a full-width box under the image block above it; `none` is a plain
   * list, such as under a chart.
   */
  attach?: 'panel' | 'none'
  /**
   * `auto` (the default) puts the items in two columns from `sm`; `one` keeps one column, for a
   * legend in a narrow column such as the text beside a small chart (#681).
   */
  columns?: 'auto' | 'one'
  className?: string
}

export type LegendProps = LegendCommon &
  (
    | {
        /** Numbered orange circles with white numbers, for an annotated image; the default */
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

const LIST_CLASSES = {
  auto: 'grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2',
  one: 'grid grid-cols-1 gap-y-3',
}

/**
 * The legend under an annotated image or a chart (#636, from the diagram key of #515): one numbered
 * circle per marker, drawn like the markers on the photo (white number and ring on the accent
 * orange the site's diagrams use), each with a bold label and a short line.
 *
 * It is a panel as wide as the image above it, with the image's caption (if any) between them:
 * rounded all round, with a border (a shadow barely shows in dark mode) and a small shadow. It is
 * still: no animation. Put it directly after the image block; it sits `--legend-gap` below it.
 *
 * The circles are decoration; screen readers hear "Marker 2: Westbound entrance loop" from a hidden
 * prefix.
 *
 * Under a chart (#662), `marker="swatch"` draws each item's chart colour instead, with the hatch
 * where the item has one, and `attach="none"` leaves out the panel. The swatch is a second cue
 * beside the label, which is always text.
 */
export function Legend(props: LegendProps) {
  const { label = 'Legend', attach = 'panel', columns = 'auto', className } = props
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
        attach === 'panel' && [
          'mb-10 rounded-2xl border border-border bg-surface p-4 shadow-sm md:p-6',
          LEGEND_GAP,
        ],
        className,
      )}
    >
      {/* `role="list"`: Safari drops list semantics from a list without bullets */}
      <List role="list" aria-label={label} className={LIST_CLASSES[columns]}>
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
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-base font-bold text-on-image ring-2 ring-on-image"
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
        'mt-1 size-5 shrink-0 rounded-sm ring-1 ring-foreground/30 print-exact',
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
