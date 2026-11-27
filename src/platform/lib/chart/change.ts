import { formatValue } from './format'
import { COMPACT_VISIBLE_ROWS } from './chartLooks'
import type { ChartSpec } from './spec'

/*
 * The arithmetic of the two compact budget looks (#1503): a figure with its change, and ranked rows
 * with a change column. Plain data in and out, so the pictures only draw what is worked out here.
 */

type Stacked = Extract<ChartSpec, { kind: 'stacked' }>
type Bar = Extract<ChartSpec, { kind: 'bar' }>

export type ChangeDirection = 'up' | 'down' | 'same'

export type Change = {
  /** Later minus earlier, in the chart's unit */
  amount: number
  /** The amount as a percent of the earlier figure; null when there was nothing before */
  percent: number | null
  direction: ChangeDirection
}

export function toChange(before: number, after: number): Change {
  const amount = after - before
  return {
    amount,
    percent: before > 0 ? (amount / before) * 100 : null,
    direction: amount > 0 ? 'up' : amount < 0 ? 'down' : 'same',
  }
}

const MINUS = '−'

/** Dollars as the post writes them: "$477.7M", "$25M", "$9.7M"; under a million, whole dollars */
export const formatCompactMoney = (value: number) => formatValue(value, 'usd', { compact: true })

/** "+$25.0M" or "−$3.4M": the sign is in the text, so it never depends on colour or an arrow */
export function formatChangeAmount(amount: number): string {
  if (amount === 0) return formatValue(0, 'usd')
  return `${amount > 0 ? '+' : MINUS}${formatCompactMoney(Math.abs(amount))}`
}

/** "+5.5%", "−2.9%", "0%"; null when there is no percent to say. A change under 0.05% is "0%". */
export function formatChangePercent(percent: number | null): string | null {
  if (percent === null) return null
  const tenths = Math.round(Math.abs(percent) * 10)
  if (tenths === 0) return '0%'
  return `${percent > 0 ? '+' : MINUS}${(tenths / 10).toFixed(1)}%`
}

export type ChangeViewPart = {
  key: string
  label: string
  value: number
  /** Share of the later total, 0 to 100 */
  percent: number
  pattern?: 'hatch'
}

export type ChangeView = {
  latest: { label: string; total: number }
  earlier: { label: string; total: number }
  change: Change
  /** The later row's parts with something in them, in the chart's order */
  parts: ChangeViewPart[]
}

const rowTotal = (spec: Stacked, row: number) =>
  spec.series.reduce((total, series) => total + series.values[row], 0)

/** A stacked chart of two rows as a change-first picture: the later figure, its change and its split */
export function toChangeView(spec: Stacked): ChangeView {
  const last = spec.x.length - 1
  const earlier = { label: spec.x[0], total: rowTotal(spec, 0) }
  const latest = { label: spec.x[last], total: rowTotal(spec, last) }
  return {
    latest,
    earlier,
    change: toChange(earlier.total, latest.total),
    parts: spec.series
      .filter((series) => series.values[last] > 0)
      .map((series) => ({
        key: series.key,
        label: series.label,
        value: series.values[last],
        percent: (series.values[last] / latest.total) * 100,
        ...(series.pattern && { pattern: series.pattern }),
      })),
  }
}

export type RankedRow = {
  key: string
  label: string
  value: number
  /** Bar length as a percent of the track, on one scale for every row */
  width: number
  change: Change | null
}

/** Compact bars as ranked rows: biggest first, the first few shown and the rest as smaller pieces */
export function toRankedRows(spec: Bar): { visible: RankedRow[]; smaller: RankedRow[] } {
  const scale = spec.scaleMax ?? Math.max(...spec.data.map((d) => d.value))
  const rows = [...spec.data]
    .sort((a, b) => b.value - a.value)
    .map(
      (datum): RankedRow => ({
        key: datum.key,
        label: datum.label,
        value: datum.value,
        width: scale > 0 ? (datum.value / scale) * 100 : 0,
        change: datum.previous === undefined ? null : toChange(datum.previous, datum.value),
      }),
    )
  return { visible: rows.slice(0, COMPACT_VISIBLE_ROWS), smaller: rows.slice(COMPACT_VISIBLE_ROWS) }
}
