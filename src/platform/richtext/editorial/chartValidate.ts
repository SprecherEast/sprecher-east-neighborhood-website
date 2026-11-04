import type { ChartIssue } from '@/platform/lib/chart/issues'

import { isFormState, storedChartIssues, type StoredChart } from './chart'

/**
 * Field errors for a chart block (#640): the block is checked as a whole with the `ChartSpec`
 * rules (`chartIssues`), and each reason is shown under the field it is about, so an editor
 * sees what to fix where. Payload has no validation for a block as a whole, so the fields the
 * rules are about carry it.
 */

/** The field an issue is shown on, from the first part of its path in the spec */
const FIELD_OF = {
  kind: 'kind',
  title: 'title',
  summary: 'summary',
  unit: 'unit',
  asOf: 'asOf',
  certainty: 'certainty',
  sources: 'sources',
  finePrint: 'finePrint',
  scaleMax: 'scaleMax',
  data: 'bars',
  series: 'series',
  rows: 'rows',
  x: 'rows',
  rowNotes: 'rows',
  mode: 'mode',
  unitNote: 'unitNote',
  groups: 'groups',
} as const satisfies Record<string, string>

/** The fields of the block that carry the chart rules */
export type ChartField = (typeof FIELD_OF)[keyof typeof FIELD_OF]
/** Where a rule about the whole chart (no path) is shown, per kind */
const WHOLE_CHART_FIELD = { bar: 'bars', stacked: 'rows', units: 'groups' } as const

const fieldOf = (issue: ChartIssue, kind: keyof typeof WHOLE_CHART_FIELD): ChartField => {
  // The numbers of a stacked chart are typed in its rows, though the spec keeps them in the series
  if (issue.path[0] === 'series' && issue.path[2] === 'values') return 'rows'
  const named: Record<string, ChartField> = FIELD_OF
  return named[String(issue.path[0] ?? '')] ?? WHOLE_CHART_FIELD[kind]
}

/** Where in the editor's rows an issue is, from its path in the spec; null for a plain field */
function where(path: ChartIssue['path']): string | null {
  const [head, i, tail, j] = path
  const n = (index: unknown) => Number(index) + 1
  switch (head) {
    case 'data':
    case 'x':
    case 'rows':
    case 'rowNotes':
      return typeof i === 'number' ? `Bar ${n(i)}` : null
    case 'series':
      if (tail === 'values') return j === undefined ? null : `Bar ${n(j)}, number ${n(i)}`
      return `Part ${n(i)}`
    case 'groups':
      if (typeof i !== 'number') return null
      return `Group ${n(i)}${tail === 'data' && typeof j === 'number' ? `, part ${n(j)}` : ''}`
    default:
      return null
  }
}

const NEGATIVE = /^Too small: expected number to be >=0$/

/** A bar's own number field has `min: 0` and says so under itself, so the list need not repeat it */
const saidByItsField = (issue: ChartIssue) =>
  issue.path[0] === 'data' && issue.path[2] === 'value' && NEGATIVE.test(issue.message)

/** One issue in the editor's words: where it is, then what is wrong */
function describe(issue: ChartIssue): string {
  const last = issue.path.at(-1)
  // The parts of a group are "parts", not "rows"
  const thing = issue.path[0] === 'groups' && last === 'data' ? 'part' : 'row'
  const message = issue.message
    .replace(/^Invalid input: expected number, received NaN$/, 'enter a number')
    .replace(NEGATIVE, "can't be negative")
    .replace(/^Too small: expected string to have >=1 characters$/, () =>
      typeof last === 'string' ? `the ${last} can't be empty` : "can't be empty",
    )
    .replace(
      /^Too small: expected array to have >=(\d+) items$/,
      (_m, n) => `Add at least ${n} ${thing}.`,
    )
  const place = where(issue.path)
  return place ? `${place}: ${message}` : message
}

/**
 * Every field of a block asks about the same chart in one save, so the last chart's issues are
 * kept, keyed by its content (not its identity: Payload may edit the data between saves).
 */
let last: { key: string; issues: ChartIssue[] } | null = null
function issuesOf(stored: StoredChart): ChartIssue[] {
  const key = JSON.stringify(stored)
  if (last?.key !== key) last = { key, issues: storedChartIssues(stored) }
  return last.issues
}

type Row = { label?: unknown; value?: unknown; values?: unknown; parts?: unknown }
const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const unlabelled = (row: Row) => typeof row.label !== 'string' || row.label.trim() === ''
const unnumbered = (row: Row) => typeof row.value !== 'number' || Number.isNaN(row.value)

/**
 * A chart Admin is still building: a row added but not yet filled in (just its id, no label or
 * number), or a list with no rows yet. Admin keeps a reason it was given for such a chart on
 * screen after the editor finishes the row, so the rules wait for the real save to judge it.
 */
function isUnfinished(stored: StoredChart): boolean {
  const lists = {
    bar: [stored.bars],
    stacked: [stored.series, stored.rows],
    units: [stored.groups],
  }
  if (stored.kind && lists[stored.kind].some((list) => rowsOf(list).length === 0)) return true
  return (
    rowsOf(stored.bars).some((row) => unlabelled(row) || unnumbered(row)) ||
    rowsOf(stored.series).some(unlabelled) ||
    rowsOf(stored.rows).some((row) => unlabelled(row) || rowsOf(row.values).some(unnumbered)) ||
    rowsOf(stored.groups).some(
      (group) =>
        unlabelled(group) ||
        rowsOf(group.parts).length === 0 ||
        rowsOf(group.parts).some((part) => unlabelled(part) || unnumbered(part)),
    )
  )
}

/**
 * Payload asks twice per save: while Admin builds the form (event `onChange`, with counts where
 * the rows will be) and on the real save (event `submit`, the data as sent). The chart rules speak
 * on a finished chart only (`isUnfinished`), and always on the real save. Payload's own checks (required, min) still run as the editor types, except
 * on a count, which they would read as the rows. On a real save a count is not rows: it is
 * judged as none.
 */
const countsOnly = (event: unknown, block: unknown) =>
  event === 'onChange' && isFormState(block as StoredChart)

/** What is wrong with a chart's `field`, or true. Reads the whole block from the field's siblings. */
export function chartFieldError(field: ChartField, block: unknown, event?: unknown): true | string {
  const stored = block as StoredChart
  if (!stored.kind || (event === 'onChange' && (isFormState(stored) || isUnfinished(stored)))) {
    return true
  }
  const issues = issuesOf(stored).filter(
    (issue) =>
      !saidByItsField(issue) &&
      fieldOf(issue, stored.kind as keyof typeof WHOLE_CHART_FIELD) === field,
  )
  return issues.length === 0 ? true : [...new Set(issues.map(describe))].join('; ')
}

type Validate<V, A> = (value: V, args: A) => true | string | Promise<true | string>

/**
 * Payload's own validation for the field (required, row counts) first, then the chart rules.
 * Fields in other kinds' conditions are not validated while hidden, so only the chosen kind speaks.
 */
export function checked<V, A extends { siblingData: unknown; event?: unknown }>(
  field: ChartField,
  own: Validate<V, A>,
): (value: V, args: A) => Promise<true | string> {
  return async (value, args) => {
    // Half-built form state (`bars: 2`): Payload's own check would read the count as the rows
    // Counts: Payload's own check would read the count as the rows
    if (countsOnly(args.event, args.siblingData)) return true
    const first = await own(value, args)
    return first === true ? chartFieldError(field, args.siblingData, args.event) : first
  }
}
