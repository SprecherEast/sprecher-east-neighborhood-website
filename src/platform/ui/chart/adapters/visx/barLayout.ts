import { scaleLinear } from '@visx/scale'

import type { BarModel, BarSegment } from './barModel'

/*
 * Where everything goes in the drawing, in SVG units (#663). The svg scales with its container, so
 * these are proportions; the width is small on purpose, so the text stays legible on a phone: on a
 * 320px screen the drawing is shown at about 0.9 of its size, and `max-w-md` stops it growing past
 * 1.4 on a desktop.
 */
export const VIEW_WIDTH = 320
export const SEGMENT_GAP = 2
export const BAR_HEIGHT = 12
export const BAR_RADIUS = 4
export const FONT_SIZE = 13
export const SMALL_FONT_SIZE = 12
/** Poppins is wide: about this much of its size per character, to place labels without measuring */
const CHAR_WIDTH = 0.6
export const PAD_X = 4
/** Baselines inside a row: its name and total, the first line of value labels, and each line after */
export const HEAD_BASELINE = 12
export const BAR_TOP = 20
export const LABEL_BASELINE = BAR_TOP + BAR_HEIGHT + 14
export const LINE_HEIGHT = 13
const NOTE_LINE = 16
const ROW_GAP = 14
const AXIS_GAP = 8
const AXIS_HEIGHT = 18
const LABEL_SPACING = 4
/** How far the scale's lines reach above and below a bar: short ticks, never through text */
export const GRID_OVERHANG = 4

export type PlacedSegment = {
  key: string
  x: number
  width: number
  /** The 2px gap taken off the front of every segment but the first */
  gap: number
  slotIndex: number
  hatch: boolean
  /** The bar's far end (its last segment with length) has the rounded corners */
  roundEnd: boolean
}

export type PlacedLabel = { text: string; x: number; anchor: 'start' | 'end'; line: number }

export type PlacedRow = {
  label: string
  totalText: string
  note: string | null
  /** Top of the row */
  y: number
  segments: PlacedSegment[]
  labels: PlacedLabel[]
  noteY: number
  height: number
}

export type BarLayout = {
  scale: (value: number) => number
  plotWidth: number
  rows: PlacedRow[]
  ticks: number[]
  axisY: number
  /** Bottom of the rows */
  gridBottom: number
  height: number
}

const textWidth = (text: string, size = SMALL_FONT_SIZE) => text.length * size * CHAR_WIDTH

/**
 * Value labels under their segments, left to right. A label starts at its segment; one that would
 * run past the right edge ends at its segment's end instead; one that would touch the label before
 * it goes on the next line down.
 */
export function placeLabels(
  items: { x0: number; x1: number; text: string }[],
  plotWidth: number,
): PlacedLabel[] {
  const ends: number[] = []
  return items.map(({ x0, x1, text }) => {
    const width = textWidth(text)
    const overflow = x0 + width > plotWidth
    const anchor = overflow ? 'end' : 'start'
    const x = overflow ? Math.min(x1, plotWidth) : x0
    const start = overflow ? x - width : x
    let line = ends.findIndex((end) => start >= end + LABEL_SPACING)
    if (line < 0) line = ends.length
    ends[line] = start + width
    return { text, x, anchor, line }
  })
}

function placeSegments(segments: BarSegment[], scale: (value: number) => number) {
  const lastWithLength = segments.reduce((last, s, i) => (s.value > 0 ? i : last), -1)
  let at = 0
  return segments.map((segment, i): PlacedSegment => {
    const end = at + segment.value
    const gap = i > 0 && segment.value > 0 ? SEGMENT_GAP : 0
    const x = scale(at) + gap
    const width = Math.max(0, scale(end) - scale(at) - gap)
    at = end
    return {
      key: segment.key,
      x,
      width,
      gap,
      slotIndex: segment.slotIndex,
      hatch: segment.hatch,
      roundEnd: i === lastWithLength,
    }
  })
}

/** Everything the drawing needs, from the rows: one scale from $0 to `scaleMax` shared by all rows */
export function layoutBars(model: BarModel): BarLayout {
  const plotWidth = VIEW_WIDTH - 2 * PAD_X
  const scale = scaleLinear({ domain: [0, model.scaleMax], range: [0, plotWidth] })
  let y = 0
  const rows = model.rows.map((row): PlacedRow => {
    const segments = placeSegments(row.segments, scale)
    const labelled = row.segments.filter((s) => s.valueText !== '')
    const labels =
      labelled.length > 1
        ? placeLabels(
            row.segments.flatMap((s, i) =>
              s.valueText === ''
                ? []
                : [{ x0: segments[i].x, x1: segments[i].x + segments[i].width, text: s.valueText }],
            ),
            plotWidth,
          )
        : []
    const lines = labels.length === 0 ? 0 : Math.max(...labels.map((l) => l.line)) + 1
    const labelsBottom = BAR_TOP + BAR_HEIGHT + (lines === 0 ? 0 : 4 + lines * LINE_HEIGHT)
    const noteY = labelsBottom + 15
    const height = labelsBottom + (row.note ? NOTE_LINE + 3 : 0)
    const placed: PlacedRow = {
      label: row.label,
      totalText: row.totalText,
      note: row.note,
      y,
      segments,
      labels,
      noteY,
      height,
    }
    y += height + ROW_GAP
    return placed
  })
  const gridBottom = y - ROW_GAP
  return {
    scale,
    plotWidth,
    rows,
    ticks: [0, model.scaleMax / 2, model.scaleMax],
    axisY: gridBottom + AXIS_GAP,
    gridBottom,
    height: gridBottom + AXIS_GAP + AXIS_HEIGHT,
  }
}
