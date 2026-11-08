import { toBreakdown } from './breakdown'
import { formatValue, UNIT_HEADERS } from './format'
import { SQUARES_PER_HUNDRED, type ChartSpec, type ChartUnit } from './spec'
import { toUnitCounts } from './unitCells'

/** The numbers behind a chart as a table: the first cell of each row heads that row */
export type ChartTable = {
  caption: string
  head: string[]
  rows: string[][]
  /** How many leading columns name the row (group and part: 2), so each is a row header */
  rowHeaders: number
}

/** One number a chart shows, with the group it belongs to (when the chart has groups) */
export type ChartPoint = { group: string | null; label: string; value: number; text: string }

const squares = (spec: Extract<ChartSpec, { kind: 'units' }>) => spec.mode === 'perHundred'

/** Every number in the chart as one point each, in reading order */
export function toChartPoints(spec: ChartSpec): ChartPoint[] {
  const point = (group: string | null, label: string, value: number): ChartPoint => ({
    group,
    label,
    value,
    text: formatValue(value, spec.unit),
  })
  switch (spec.kind) {
    case 'units':
      return spec.groups.flatMap((g) => g.data.map((d) => point(g.label, d.label, d.value)))
    case 'bar':
      return spec.data.map((d) => point(null, d.label, d.value))
    case 'stacked':
      return spec.x.flatMap((row, i) => spec.series.map((s) => point(row, s.label, s.values[i])))
    case 'breakdown': {
      const { areas, smaller } = toBreakdown(spec)
      return areas.flatMap((area) => [
        point(null, area.label, area.value),
        ...[...area.shown, ...smaller.filter((p) => p.area === area.label)]
          .sort((a, b) => b.value - a.value)
          .map((piece) => point(area.label, piece.label, piece.value)),
      ])
    }
  }
}

/** The table that carries the same numbers as the chart, for "Show the numbers" */
export function toChartTable(spec: ChartSpec): ChartTable {
  const caption = `${spec.title}: ${UNIT_HEADERS[spec.unit]}`
  const money = (value: number) => formatValue(value, spec.unit)
  switch (spec.kind) {
    case 'bar':
      return {
        caption,
        rowHeaders: 1,
        head: ['Item', UNIT_HEADERS[spec.unit]],
        rows: spec.data.map((d) => [d.label, money(d.value)]),
      }
    case 'stacked': {
      const notes = spec.rowNotes
      return {
        caption,
        rowHeaders: 1,
        head: ['Item', ...spec.series.map((s) => s.label), 'Total', ...(notes ? ['Note'] : [])],
        rows: spec.x.map((row, i) => [
          row,
          ...spec.series.map((s) => money(s.values[i])),
          money(spec.series.reduce((total, s) => total + s.values[i], 0)),
          ...(notes ? [notes[i]] : []),
        ]),
      }
    }
    case 'breakdown': {
      const { areas, smaller, total } = toBreakdown(spec)
      const percent = (value: number) =>
        formatValue(Number(((value / total) * 100).toFixed(1)), 'percent')
      return {
        caption,
        rowHeaders: 2,
        head: ['Area', 'Piece', 'Squares', UNIT_HEADERS[spec.unit], 'Share (percent)'],
        rows: areas.flatMap((area) => [
          [area.label, 'Whole area', String(area.squares), money(area.value), percent(area.value)],
          ...[...area.shown, ...smaller.filter((p) => p.area === area.label)]
            .sort((a, b) => b.value - a.value)
            .map((piece) => [
              area.label,
              piece.label,
              '',
              money(piece.value),
              percent(piece.value),
            ]),
        ]),
      }
    }
    case 'units': {
      const grouped = spec.groups.length > 1
      const perHundred = squares(spec)
      return {
        caption,
        rowHeaders: grouped ? 2 : 1,
        head: [
          ...(grouped ? ['Group'] : []),
          perHundred ? 'Part' : 'Item',
          ...(perHundred ? [`Squares out of ${SQUARES_PER_HUNDRED}`] : []),
          UNIT_HEADERS[spec.unit],
        ],
        rows: spec.groups.flatMap((g) => {
          const counts = perHundred ? toUnitCounts(g.data, SQUARES_PER_HUNDRED) : []
          return g.data.map((d, i) => [
            ...(grouped ? [g.label] : []),
            d.label,
            ...(perHundred ? [String(counts[i])] : []),
            money(d.value),
          ])
        }),
      }
    }
  }
}

const list = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

/** Dollars short ($194.8M), so a sentence reads aloud easily */
const say = (value: number, unit: ChartUnit) => formatValue(value, unit, { compact: true })

/**
 * A short description of the chart's shape and what is in it, for assistive technology and the
 * text version: whole sentences, so it reads aloud without the picture.
 */
export function toChartSummary(spec: ChartSpec): string {
  switch (spec.kind) {
    case 'bar':
      return `${spec.data.length} bars: ${list(spec.data.map((d) => `${d.label} ${say(d.value, spec.unit)}`))}.`
    case 'stacked':
      return `Stacked bars for ${list(spec.x)}, each split into ${list(spec.series.map((s) => s.label))}. ${spec.x
        .map(
          (row, i) =>
            `${row}: ${list(spec.series.map((s) => `${s.label} ${say(s.values[i], spec.unit)}`))}.`,
        )
        .join(' ')}`
    case 'breakdown': {
      const { areas, squareCount, total } = toBreakdown(spec)
      return `A grid of ${squareCount} squares, ${say(spec.squareValue, spec.unit)} each, sharing out ${say(total, spec.unit)}: ${list(areas.map((a) => `${a.label} ${say(a.value, spec.unit)}`))}.`
    }
    case 'units':
      return spec.groups
        .map((g) => {
          if (!squares(spec)) {
            return `${g.label}: ${g.data.length} tiles, ${list(g.data.map((d) => `${d.label} ${say(d.value, spec.unit)}`))}.`
          }
          const counts = toUnitCounts(g.data, SQUARES_PER_HUNDRED)
          return `${g.label}, a grid of ${SQUARES_PER_HUNDRED} squares: ${list(g.data.map((d, i) => `${d.label} ${counts[i]} of every $${SQUARES_PER_HUNDRED}`))}.`
        })
        .join(' ')
  }
}

/**
 * What one square is worth, per grid, worked out from the data so the wording cannot drift from
 * it. Two grids have different totals, so equal square counts are not equal dollars. Null for
 * charts that are not a grid of 100.
 */
export function toScaleNote(spec: ChartSpec): string | null {
  if (spec.kind !== 'units' || spec.mode !== 'perHundred') return null
  const perSquare = (group: (typeof spec.groups)[number]) => {
    const total = group.total ?? group.data.reduce((sum, d) => sum + d.value, 0)
    return `about ${formatValue(total / SQUARES_PER_HUNDRED, spec.unit, { compact: true })}`
  }
  const lead = `Each square is $1 of every $${SQUARES_PER_HUNDRED}`
  if (spec.groups.length === 1) return `${lead} (${perSquare(spec.groups[0])}).`
  return `${lead}: ${list(spec.groups.map((g) => `${perSquare(g)} in ${g.label}`))}. Equal numbers of squares are not equal dollars.`
}
