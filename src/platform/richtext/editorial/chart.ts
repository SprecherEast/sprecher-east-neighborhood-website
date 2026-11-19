import type { ChartBlock } from '@/payload-types'

import { chartIssues, InvalidChartError, type ChartIssue } from '@/platform/lib/chart/issues'
import { parseChartSpec, type ChartSpec } from '@/platform/lib/chart/spec'

import { blank, keysOf } from './chartKeys'

/**
 * The chart block's stored fields and `ChartSpec`, both ways (#640, decision 0013). The block
 * stores what an editor fills in (rows of numbers, a checkbox for hatching); the spec is what
 * `Chart` draws and what an agent writes in Markdown. `toChartSpec` is the one way in: it
 * returns a valid spec or throws every reason, so an editor never saves a chart that would draw
 * wrongly and the page never draws one.
 */

/** The fields of one chart block, as stored (Payload's null for an empty field included) */
export type StoredChart = Partial<Omit<ChartBlock, 'blockType' | 'id' | 'blockName'>>
/** What `fromChartSpec` fills in; `StoredChart` without the nulls */
type Stored<K extends keyof StoredChart> = NonNullable<StoredChart[K]>

/**
 * An array field's rows. Admin's form state gives the row count (a number) until the rows are
 * built, so anything that is not an array has no rows: this never throws on what Admin hands it.
 */
const list = <T>(value: readonly T[] | number | null | undefined): readonly T[] =>
  Array.isArray(value) ? value : []

const orUndefined = <T>(items: T[]): T[] | undefined => (items.length > 0 ? items : undefined)

/** The value without the properties left undefined, so an unset field is absent, not `undefined` */
function prune<T>(value: T): T {
  if (Array.isArray(value)) return value.map(prune) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, prune(v)]),
    ) as T
  }
  return value
}

/**
 * Whether readers can tap the chart to enlarge it (#686). The editor's checkbox is on by default
 * and a chart stored before it existed has no value, so only an explicit `false` turns it off.
 */
export const isEnlargeable = (stored: StoredChart): boolean => stored.enlarge !== false

const hatch = (on: boolean | null | undefined) => (on ? ({ pattern: 'hatch' } as const) : {})

function partsOf(
  items: readonly {
    key?: string | null
    label?: string | null
    value?: number | null
    hatch?: boolean | null
  }[],
) {
  const keys = keysOf(items)
  return items.map((item, i) => ({
    key: keys[i],
    label: item.label ?? '',
    value: item.value ?? NaN,
    ...hatch(item.hatch),
  }))
}

function stackedOf(stored: StoredChart) {
  const rows = list(stored.rows)
  const keys = keysOf(list(stored.series))
  const notes = rows.map((row) => blank(row.note))
  return {
    orientation: 'horizontal',
    scaleMax: stored.scaleMax ?? undefined,
    x: rows.map((row) => row.label ?? ''),
    series: list(stored.series).map((series, i) => ({
      key: keys[i],
      label: series.label ?? '',
      ...hatch(series.hatch),
      ...(series.increase ? { increase: true } : {}),
      values: rows.map((row) => list(row.values)[i]?.value ?? NaN),
    })),
    rowNotes: notes.some(Boolean) ? notes.map((note) => note ?? '') : undefined,
  }
}

function unitsOf(stored: StoredChart) {
  const groups = list(stored.groups)
  const keys = keysOf(groups)
  return {
    mode: stored.mode ?? undefined,
    unitNote: blank(stored.unitNote) ?? '',
    groups: groups.map((group, i) => ({
      key: keys[i],
      label: group.label ?? '',
      total: group.total ?? undefined,
      data: partsOf(list(group.parts)),
    })),
  }
}

/**
 * A breakdown's areas and their pieces. Keys are made over areas and pieces together, so a piece
 * that shares a name with another area's piece still gets its own.
 */
function breakdownOf(stored: StoredChart) {
  const areas = list(stored.areas)
  const pieces = areas.map((area) => list(area.pieces))
  const keys = keysOf([...areas, ...pieces.flat()])
  let next = areas.length
  return {
    ...(stored.hideSquares ? { hideSquares: true } : { squareValue: stored.squareValue ?? NaN }),
    areas: areas.map((area, i) => {
      const own = pieces[i].map((piece) => {
        const key = keys[next++]
        return {
          key,
          label: piece.label ?? '',
          value: piece.value ?? NaN,
          ...(piece.shown ? { shown: true as const } : {}),
        }
      })
      return {
        key: keys[i],
        label: area.label ?? '',
        value: area.value ?? NaN,
        pieces: orUndefined(own),
      }
    }),
  }
}

/** The spec the stored block describes, not yet checked. `NaN` stands for a number left empty. */
export function toChartSpecInput(stored: StoredChart): Record<string, unknown> {
  const sources = list(stored.sources)
    .filter((source) => blank(source.linkLabel) || blank(source.linkUrl))
    .map((source) => ({ label: source.linkLabel ?? '', href: source.linkUrl ?? '' }))
  const base = {
    kind: stored.kind ?? undefined,
    title: stored.title ?? '',
    summary: stored.summary ?? '',
    unit: stored.unit ?? undefined,
    palette: stored.palette ?? undefined,
    asOf: blank(stored.asOf),
    certainty: stored.certainty ?? undefined,
    sources: orUndefined(sources),
    finePrint: blank(stored.finePrint),
  }
  switch (stored.kind) {
    case 'bar':
      return prune({
        ...base,
        orientation: 'horizontal',
        scaleMax: stored.scaleMax ?? undefined,
        data: partsOf(list(stored.bars)),
      })
    case 'stacked':
      return prune({ ...base, ...stackedOf(stored) })
    case 'units':
      return prune({ ...base, ...unitsOf(stored) })
    case 'breakdown':
      return prune({ ...base, ...breakdownOf(stored) })
    default:
      return prune(base)
  }
}

/**
 * What is wrong with a stacked chart's rows before they are laid out as the spec's series: a row
 * with more or fewer numbers than there are parts would be cut or padded without a word.
 */
function rowIssues(stored: StoredChart): ChartIssue[] {
  if (stored.kind !== 'stacked') return []
  const parts = stored.series?.length ?? 0
  return list(stored.rows).flatMap((row, i) => {
    const count = list(row.values).length
    return count === parts
      ? []
      : [
          {
            path: ['rows', i, 'values'],
            message: `has ${count} ${count === 1 ? 'number' : 'numbers'} but there ${parts === 1 ? 'is' : 'are'} ${parts} ${parts === 1 ? 'part' : 'parts'}: give one number for each`,
          },
        ]
  })
}

/** Every reason the stored block is not a valid chart, empty when it is */
export function storedChartIssues(stored: StoredChart): ChartIssue[] {
  return [...rowIssues(stored), ...chartIssues(toChartSpecInput(stored))]
}

/** The stored block as a valid `ChartSpec`, or an `InvalidChartError` listing every reason */
export function toChartSpec(stored: StoredChart): ChartSpec {
  const input = toChartSpecInput(stored)
  const issues = storedChartIssues(stored)
  if (issues.length > 0) throw new InvalidChartError(issues)
  return parseChartSpec(input)
}

const isHatched = (item: { pattern?: 'hatch' }) => item.pattern === 'hatch'

/** The inverse of `toChartSpec`: the fields to store for a spec, as an agent's tag or a fixture gives it */
export function fromChartSpec(spec: ChartSpec): StoredChart {
  const base: StoredChart = {
    kind: spec.kind,
    title: spec.title,
    summary: spec.summary,
    unit: spec.unit,
    palette: spec.palette,
    asOf: spec.asOf,
    certainty: spec.certainty,
    finePrint: spec.finePrint,
    sources: spec.sources?.map(({ label, href }) => ({ linkLabel: label, linkUrl: href })),
  }
  const parts = (data: Extract<ChartSpec, { kind: 'bar' }>['data']): Stored<'bars'> =>
    data.map((d) => ({ key: d.key, label: d.label, value: d.value, hatch: isHatched(d) }))
  switch (spec.kind) {
    case 'bar':
      return { ...base, scaleMax: spec.scaleMax, bars: parts(spec.data) }
    case 'stacked':
      return {
        ...base,
        scaleMax: spec.scaleMax,
        series: spec.series.map((s) => ({
          key: s.key,
          label: s.label,
          hatch: isHatched(s),
          increase: s.increase === true,
        })),
        rows: spec.x.map((label, row) => ({
          label,
          note: spec.rowNotes?.[row],
          values: spec.series.map((s) => ({ value: s.values[row] })),
        })),
      }
    case 'breakdown':
      return {
        ...base,
        squareValue: spec.squareValue,
        hideSquares: spec.hideSquares === true,
        areas: spec.areas.map((area) => ({
          key: area.key,
          label: area.label,
          value: area.value,
          pieces: area.pieces?.map((piece) => ({
            key: piece.key,
            label: piece.label,
            value: piece.value,
            shown: piece.shown === true,
          })),
        })),
      }
    case 'units':
      return {
        ...base,
        mode: spec.mode,
        unitNote: spec.unitNote,
        groups: spec.groups.map((g) => ({
          key: g.key,
          label: g.label,
          total: g.total,
          parts: parts(g.data),
        })),
      }
  }
}

/**
 * True when `stored` is Admin's half-built form state, where an array field is its row count
 * (`bars: 2`) rather than its rows: there is no chart to judge yet. A count of 0 is no rows.
 */
export function isFormState(stored: StoredChart): boolean {
  // 0 is an empty array: Admin gives that too, including when publishing
  const counted = (value: unknown) => typeof value === 'number' && value > 0
  return (
    [stored.sources, stored.bars, stored.series, stored.rows, stored.groups, stored.areas].some(
      counted,
    ) ||
    list(stored.areas).some((area) => counted(area.pieces)) ||
    list(stored.rows).some((row) => counted(row.values)) ||
    list(stored.groups).some((group) => counted(group.parts))
  )
}
