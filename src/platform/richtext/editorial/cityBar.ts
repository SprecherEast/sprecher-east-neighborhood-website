import { formatWholeDollars } from '@/platform/lib/chart/format'
import type { ChartSpec } from '@/platform/lib/chart/spec'
import type { AmountBarPart } from '@/platform/ui/AmountBar'

type Stacked = Extract<ChartSpec, { kind: 'stacked' }>

/** `amount` in whole dollars split in proportion to the values, the last taking the rounding */
function splitWhole(values: readonly number[], amount: number): number[] {
  const sum = values.reduce((all, value) => all + value, 0)
  let used = 0
  return values.map((value, index) => {
    const part =
      index === values.length - 1 ? amount - used : Math.round(sum > 0 ? (value / sum) * amount : 0)
    used += part
    return part
  })
}

/**
 * One column of a stacked chart (a year) as the single bar at the top of the City's panel (#1020):
 * its name, the whole amount and its parts. The chart says which parts there are and in what
 * order; the dollars come from the City's tax on the home (`cityAmount`, or the chart's own column
 * scaled by `homeRatio`, the typed home's share of the chart's average home, when the City's tax is
 * not known). `increase` is what the increase parts add up to, in whole dollars: it is given, from
 * the two priced years (`increaseIn`, #1121), so the bar, the answer card's line and the tab's
 * figure are one number; the other parts share the rest in the chart's proportions, the last taking
 * the rounding, so the rounded parts always add up to the rounded whole. With no `increase` (null:
 * the data cannot support one) no increase part is drawn and none is reported. A part that is
 * nothing that year is left out. A `column` between two years (a position part-way through a
 * count, #1096) blends the two columns and names the nearer year, so the bar can count from one
 * year to the next.
 */
export function toCityBar(
  spec: Stacked,
  {
    column,
    cityAmount,
    increase,
    homeRatio = 1,
  }: { column: number; cityAmount: number | null; increase: number | null; homeRatio?: number },
): { title: string; total: string; parts: AmountBarPart[]; increase: number | null } {
  const first = Math.floor(column)
  const share = column - first
  const valueAt = (values: readonly number[]) =>
    (values[first] ?? 0) * (1 - share) + (values[first + 1] ?? values[first] ?? 0) * share
  const shown = spec.series
    .map((series) => ({ series, value: valueAt(series.values) }))
    .filter(({ value }) => value > 0)
  const kept = shown.filter(({ series }) => increase !== null || !series.increase)
  const chartTotal = shown.reduce((sum, { value }) => sum + value, 0)
  const total = cityAmount ?? chartTotal * homeRatio
  const whole = Math.round(total)
  const increases = kept.filter(({ series }) => series.increase)
  const others = kept.filter(({ series }) => !series.increase)
  // A chart of increases alone has nothing else to take the rest, so its increase is the whole
  const increaseAmount =
    increase === null || increases.length === 0
      ? 0
      : others.length === 0
        ? whole
        : Math.min(Math.max(Math.round(increase), 0), whole)
  const amounts = new Map<string, number>()
  const fill = (group: typeof kept, amount: number) =>
    splitWhole(
      group.map(({ value }) => value),
      amount,
    ).forEach((part, index) => amounts.set(group[index]?.series.key ?? '', part))
  fill(increases, increaseAmount)
  fill(others, whole - increaseAmount)
  const parts = kept.map(({ series }): AmountBarPart => {
    const amount = amounts.get(series.key) ?? 0
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
    increase: increase === null ? null : increaseAmount,
  }
}
