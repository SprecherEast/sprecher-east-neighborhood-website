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
 * the rounding, so the rounded parts always add up to the rounded whole.
 */
export function toCityBar(
  spec: Stacked,
  {
    column,
    cityAmount,
    homeRatio = 1,
  }: { column: number; cityAmount: number | null; homeRatio?: number },
): { title: string; total: string; parts: AmountBarPart[] } {
  const shown = spec.series
    .map((series) => ({ series, value: series.values[column] ?? 0 }))
    .filter(({ value }) => value > 0)
  const specTotal = shown.reduce((sum, { value }) => sum + value, 0)
  const total = cityAmount ?? specTotal * homeRatio
  const factor = specTotal > 0 ? total / specTotal : 0
  const whole = Math.round(total)
  let used = 0
  const parts = shown.map(({ series, value }, index): AmountBarPart => {
    const last = index === shown.length - 1
    const amount = last ? whole - used : Math.round(value * factor)
    used += amount
    return {
      key: series.key,
      label: series.label,
      value: Math.max(amount, 0),
      amount: `${series.increase ? '+' : ''}${formatWholeDollars(amount)}`,
      hatch: series.pattern === 'hatch',
    }
  })
  return { title: spec.x[column] ?? '', total: formatWholeDollars(total), parts }
}
