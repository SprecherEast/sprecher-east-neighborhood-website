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
