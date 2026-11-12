import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import type { AmountBarPart } from '@/platform/ui/AmountBar'

type Stacked = Extract<ChartSpec, { kind: 'stacked' }>

/**
 * One column of a stacked chart (a year) as the single bar at the top of the City's panel (#1020):
 * its name, the whole amount and its parts. The parts keep the chart's own split (the same as last
 * year, the proposed increase), scaled so they add up to what the City's tax is on the home typed
 * (`cityAmount`), or by `homeRatio`, the typed home's share of the chart's average home, when the
 * City's tax is not known. A part that is nothing that year is left out, and the last part takes
 * the rounding, so the rounded parts always add up to the rounded whole. `increase` is what the
 * increase parts add up to, in whole dollars, for the tab's figure and heading (#1029). A `column`
 * between two years (a position part-way through a count, #1096) blends the two columns and names
 * the nearer year, so the bar can count from one year to the next.
 */
export function toCityBar(
  spec: Stacked,
  {
    column,
    cityAmount,
    homeRatio = 1,
  }: { column: number; cityAmount: number | null; homeRatio?: number },
): { title: string; total: string; parts: AmountBarPart[]; increase: number } {
  const first = Math.floor(column)
  const share = column - first
  const valueAt = (values: readonly number[]) =>
    (values[first] ?? 0) * (1 - share) + (values[first + 1] ?? values[first] ?? 0) * share
  const shown = spec.series
    .map((series) => ({ series, value: valueAt(series.values) }))
    .filter(({ value }) => value > 0)
  const specTotal = shown.reduce((sum, { value }) => sum + value, 0)
  const total = cityAmount ?? specTotal * homeRatio
  const factor = specTotal > 0 ? total / specTotal : 0
  const whole = Math.round(total)
  let used = 0
  // The increase parts' rounded amounts, summed: the figure the bar itself shows (#1029)
  let increase = 0
  const parts = shown.map(({ series, value }, index): AmountBarPart => {
    const last = index === shown.length - 1
    const amount = last ? whole - used : Math.round(value * factor)
    used += amount
    if (series.increase) increase += Math.max(amount, 0)
    return {
      key: series.key,
      label: series.label,
      value: Math.max(amount, 0),
      amount: `${series.increase ? '+' : ''}${formatWholeDollars(amount)}`,
      hatch: series.pattern === 'hatch',
    }
  })
  return {
    title: spec.x[Math.round(column)] ?? '',
    total: formatWholeDollars(total),
    parts,
    increase,
  }
}
