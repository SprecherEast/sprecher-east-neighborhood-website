import type { BillBody } from '@/platform/lib/billShare'

import { rampAt } from './chart/chartPalette'

/*
 * The colors of a whole's slices, in one place so a bar and the line a nested row sets under its slice can
 * never differ (#1111, #1196, #1263). Each tone is one step of the breakdown chart's ramp, so a slice reads
 * as the same color as the chart beside it: `rust` the darkest, then `amber`, `mint` and `green`. Each has
 * the bar's fill and the color of that line (`edge`).
 */
const tone = (step: number) => {
  const { fill, border } = rampAt(step)
  return { fill, edge: border }
}

export const SHARE_TONES = {
  rust: tone(1),
  amber: tone(2),
  mint: tone(3),
  green: tone(4),
} as const

export type ShareTone = keyof typeof SHARE_TONES

/** The tone of each body of a property tax bill: the City amber, the schools dark red-orange, the County green, Madison College light green (#1263) */
export const BILL_BODY_TONES: Record<BillBody, ShareTone> = {
  schools: 'rust',
  city: 'amber',
  county: 'green',
  matc: 'mint',
}
