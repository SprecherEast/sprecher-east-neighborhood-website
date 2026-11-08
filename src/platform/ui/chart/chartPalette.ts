import type { LegendSlot } from '@/platform/ui/Legend'

/** The classes of one chart colour. Written out in full so Tailwind finds each class. */
export type SlotClasses = { slot: LegendSlot; bg: string; fill: string; stroke: string }

export type ChartPalette = readonly SlotClasses[]

/** `chart-1` to `chart-6` (#661). A mark's slot is its position + 1, and slots never repeat. */
export const CHART_PALETTE: ChartPalette = [
  { slot: 1, bg: 'bg-chart-1', fill: 'fill-chart-1', stroke: 'stroke-chart-1' },
  { slot: 2, bg: 'bg-chart-2', fill: 'fill-chart-2', stroke: 'stroke-chart-2' },
  { slot: 3, bg: 'bg-chart-3', fill: 'fill-chart-3', stroke: 'stroke-chart-3' },
  { slot: 4, bg: 'bg-chart-4', fill: 'fill-chart-4', stroke: 'stroke-chart-4' },
  { slot: 5, bg: 'bg-chart-5', fill: 'fill-chart-5', stroke: 'stroke-chart-5' },
  { slot: 6, bg: 'bg-chart-6', fill: 'fill-chart-6', stroke: 'stroke-chart-6' },
]

/** The colour of the part at `index`. A seventh part is an error: the schema folds those into "Other". */
export function slotAt(palette: ChartPalette, index: number): SlotClasses {
  const slot = palette[index]
  if (!slot)
    throw new RangeError(`A chart has ${palette.length} colours: part ${index + 1} has none`)
  return slot
}

/** The classes of one step of the breakdown's seven-step ramp */
export type RampClasses = { step: number; bg: string; fill: string; border: string }

/**
 * `chart-ramp-1` to `chart-ramp-7` (#866): the breakdown chart's colours, by rank, the biggest
 * area first. Written out in full so Tailwind finds each class.
 */
export const CHART_RAMP: readonly RampClasses[] = [
  { step: 1, bg: 'bg-chart-ramp-1', fill: 'fill-chart-ramp-1', border: 'border-chart-ramp-1/55' },
  { step: 2, bg: 'bg-chart-ramp-2', fill: 'fill-chart-ramp-2', border: 'border-chart-ramp-2/55' },
  { step: 3, bg: 'bg-chart-ramp-3', fill: 'fill-chart-ramp-3', border: 'border-chart-ramp-3/55' },
  { step: 4, bg: 'bg-chart-ramp-4', fill: 'fill-chart-ramp-4', border: 'border-chart-ramp-4/55' },
  { step: 5, bg: 'bg-chart-ramp-5', fill: 'fill-chart-ramp-5', border: 'border-chart-ramp-5/55' },
  { step: 6, bg: 'bg-chart-ramp-6', fill: 'fill-chart-ramp-6', border: 'border-chart-ramp-6/55' },
  { step: 7, bg: 'bg-chart-ramp-7', fill: 'fill-chart-ramp-7', border: 'border-chart-ramp-7/55' },
]

/** The classes of ramp step `step` (1 to 7) */
export function rampAt(step: number): RampClasses {
  const classes = CHART_RAMP[step - 1]
  if (!classes)
    throw new RangeError(`The ramp has steps 1 to ${CHART_RAMP.length}: no step ${step}`)
  return classes
}
