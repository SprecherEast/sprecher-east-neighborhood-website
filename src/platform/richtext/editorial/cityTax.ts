import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'

type Stacked = Extract<ChartSpec, { kind: 'stacked' }>

/**
 * The City's tax for one column of a stacked chart (a year), and its increase (#1020, #1150): what
 * the answer card and the tab's figures show. The dollars come from the City's tax on the home
 * (`cityAmount`, or the chart's own column scaled by `homeRatio`, the typed home's share of the
 * chart's average home, when the City's tax is not known). `increase` is given, from the two
 * priced years (`increaseIn`, #1121), and comes back in whole dollars, never below 0 or above the
 * whole tax, so the answer card's line and the tab's figure are one number; a chart of increases
 * alone makes the whole tax the increase. With no `increase` (null: the data cannot support one),
 * or no increase part in the chart that year, none is reported. A `column` between two years (a
 * position part-way through a count, #1096) blends the two columns, so the tax can count from one
 * year to the next.
 */
export function toCityTax(
  spec: Stacked,
  {
    column,
    cityAmount,
    increase,
    homeRatio = 1,
  }: { column: number; cityAmount: number | null; increase: number | null; homeRatio?: number },
): { total: string; increase: number | null } {
  const first = Math.floor(column)
  const share = column - first
  const valueAt = (values: readonly number[]) =>
    (values[first] ?? 0) * (1 - share) + (values[first + 1] ?? values[first] ?? 0) * share
  const shown = spec.series
    .map((series) => ({ series, value: valueAt(series.values) }))
    .filter(({ value }) => value > 0)
  const chartTotal = shown.reduce((sum, { value }) => sum + value, 0)
  const total = cityAmount ?? chartTotal * homeRatio
  const whole = Math.round(total)
  const hasIncrease = shown.some(({ series }) => series.increase)
  const hasOthers = shown.some(({ series }) => !series.increase)
  // A chart of increases alone has nothing else to take the rest, so its increase is the whole
  const increaseAmount =
    increase === null || !hasIncrease
      ? 0
      : !hasOthers
        ? whole
        : Math.min(Math.max(Math.round(increase), 0), whole)
  return {
    total: formatWholeDollars(total),
    increase: increase === null ? null : increaseAmount,
  }
}
