import { formatValue } from '@/platform/lib/chart/format'
import type { ChartSpec, ChartUnit } from '@/platform/lib/chart/spec'

/** One mark: a bar, or one part of a stacked bar */
export type BarSegment = {
  /** The datum's key, or the series' key: written to `data-chart-mark` */
  key: string
  value: number
  /** Position in the palette: a series' position, or the first colour for a plain bar */
  slotIndex: number
  hatch: boolean
  /** "$452.7M", "+$24.8M" for an increase, and nothing for a zero (it has no length to label) */
  valueText: string
}

/** One horizontal bar with its name, its total and an optional note under it */
export type BarRow = {
  label: string
  total: number
  totalText: string
  segments: BarSegment[]
  note: string | null
}

export type BarModel = { unit: ChartUnit; scaleMax: number; rows: BarRow[] }

const short = (value: number, unit: ChartUnit) => formatValue(value, unit, { compact: true })

/** A bar or stacked spec as rows of segments, in the units the drawing needs and nothing of the library's */
export function toBarModel(spec: ChartSpec): BarModel {
  if (spec.kind === 'units') throw new Error('The visx adapter does not draw units charts')
  if (spec.orientation !== 'horizontal') {
    throw new RangeError('The visx adapter draws horizontal bars only')
  }
  const { unit } = spec
  const rows: BarRow[] =
    spec.kind === 'bar'
      ? spec.data.map((datum) => ({
          label: datum.label,
          total: datum.value,
          totalText: short(datum.value, unit),
          note: null,
          segments: [
            {
              key: datum.key,
              value: datum.value,
              slotIndex: 0,
              hatch: datum.pattern === 'hatch',
              valueText: short(datum.value, unit),
            },
          ],
        }))
      : spec.x.map((label, row) => {
          const segments = spec.series.map((series, slotIndex) => ({
            key: series.key,
            value: series.values[row],
            // an increase is the first series' colour again, hatched: more of the same, not a new thing
            slotIndex: series.increase ? 0 : slotIndex,
            hatch: series.pattern === 'hatch',
            valueText:
              series.values[row] === 0
                ? ''
                : `${series.increase ? '+' : ''}${short(series.values[row], unit)}`,
          }))
          const total = segments.reduce((sum, s) => sum + s.value, 0)
          return {
            label,
            total,
            totalText: short(total, unit),
            segments,
            note: spec.rowNotes?.[row] ?? null,
          }
        })
  const longest = Math.max(...rows.map((row) => row.total))
  return { unit, scaleMax: spec.scaleMax ?? (longest || 1), rows }
}
