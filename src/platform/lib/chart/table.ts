import { toBreakdown } from './breakdown'
import { formatChangeAmount, formatChangePercent, toChange, toChangeView } from './change'
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
    case 'bar': {
      // The compact rows carry what each was before and how it changed (#1503)
      if (!spec.data.some((d) => d.previous !== undefined)) {
        return {
          caption,
          rowHeaders: 1,
          head: ['Item', UNIT_HEADERS[spec.unit]],
          rows: spec.data.map((d) => [d.label, money(d.value)]),
        }
      }
      return {
        caption,
        rowHeaders: 1,
        head: ['Item', UNIT_HEADERS[spec.unit], spec.previousLabel ?? 'Before', 'Change'],
        rows: spec.data.map((d) => {
          if (d.previous === undefined) return [d.label, money(d.value), '', '']
          const change = toChange(d.previous, d.value)
          const percent = formatChangePercent(change.percent)
          return [
            d.label,
            money(d.value),
            money(d.previous),
            `${formatChangeAmount(change.amount)}${percent ? ` (${percent})` : ''}`,
          ]
        }),
      }
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
      const { areas, smaller, total, showSquares } = toBreakdown(spec)
      const percent = (value: number) =>
        formatValue(Number(((value / total) * 100).toFixed(1)), 'percent')
      // The squares column is left out, with the grid it counts, when the squares are hidden
      const squaresCell = (cell: string) => (showSquares ? [cell] : [])
      return {
        caption,
        rowHeaders: 2,
        head: [
          'Area',
          'Piece',
          ...squaresCell('Squares'),
          UNIT_HEADERS[spec.unit],
          'Share (percent)',
        ],
        rows: areas.flatMap((area) => [
          [
            area.label,
            'Whole area',
            ...squaresCell(String(area.squares)),
            money(area.value),
            percent(area.value),
          ],
          ...[...area.shown, ...smaller.filter((p) => p.area === area.label)]
            .sort((a, b) => b.value - a.value)
            .map((piece) => [
              area.label,
              piece.label,
              ...squaresCell(''),
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

type Bar = Extract<ChartSpec, { kind: 'bar' }>
type Stacked = Extract<ChartSpec, { kind: 'stacked' }>

const list = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

/** Dollars short ($194.8M), so a sentence reads aloud easily */
const say = (value: number, unit: ChartUnit) => formatValue(value, unit, { compact: true })

const WORDS = { up: 'up', down: 'down', same: 'no change' } as const

/** What a change is in words: "up $8.5M (4.6%)", "down $3.4M (2.9%)" or "no change" */
function changeWords(before: number, after: number, unit: ChartUnit): string {
  const { amount, percent, direction } = toChange(before, after)
  if (direction === 'same') return WORDS.same
  const share = percent === null ? '' : ` (${Math.abs(percent).toFixed(1)}%)`
  return `${WORDS[direction]} ${say(Math.abs(amount), unit)}${share}`
}

/** The compact rows' change sentence, or nothing when no bar has an earlier amount */
function barChanges(spec: Bar): string {
  const compared = spec.data.filter((d) => d.previous !== undefined)
  if (compared.length === 0) return ''
  return ` Change from ${spec.previousLabel}: ${list(compared.map((d) => `${d.label} ${changeWords(d.previous ?? 0, d.value, spec.unit)}`))}.`
}

/** The change-first look says its headline change first, in a sentence */
function stackedChange(spec: Stacked): string {
  if (spec.look !== 'change') return ''
  const { latest, earlier } = toChangeView(spec)
  return `${latest.label} ${say(latest.total, spec.unit)}, ${changeWords(earlier.total, latest.total, spec.unit)} from ${earlier.label}. `
}

/**
 * A short description of the chart's shape and what is in it, for assistive technology and the
 * text version: whole sentences, so it reads aloud without the picture.
 */
export function toChartSummary(spec: ChartSpec): string {
  switch (spec.kind) {
    case 'bar':
      return `${spec.data.length} bars: ${list(spec.data.map((d) => `${d.label} ${say(d.value, spec.unit)}`))}.${barChanges(spec)}`
    case 'stacked':
      return `${stackedChange(spec)}Stacked bars for ${list(spec.x)}, each split into ${list(spec.series.map((s) => s.label))}. ${spec.x
        .map(
          (row, i) =>
            `${row}: ${list(spec.series.map((s) => `${s.label} ${say(s.values[i], spec.unit)}`))}.`,
        )
        .join(' ')}`
    case 'breakdown': {
      const { areas, squareCount, total, showSquares } = toBreakdown(spec)
      const shares = list(areas.map((a) => `${a.label} ${say(a.value, spec.unit)}`))
      if (!showSquares || spec.squareValue === undefined) {
        return `Ranked bars sharing out ${say(total, spec.unit)}: ${shares}.`
      }
      return `A grid of ${squareCount} squares, ${say(spec.squareValue, spec.unit)} each, sharing out ${say(total, spec.unit)}: ${shares}.`
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
