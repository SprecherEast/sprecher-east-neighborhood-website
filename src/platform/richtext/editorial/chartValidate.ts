import { chartIssues, type ChartIssue } from '@/platform/lib/chart/issues'

import { toChartSpecInput, type StoredChart } from './chart'

/**
 * Field errors for a chart block (#640): the block is checked as a whole with the `ChartSpec`
 * rules (`chartIssues`), and each reason is shown under the field it is about, so an editor
 * sees what to fix where. Payload has no validation for a block as a whole, so the fields the
 * rules are about carry it.
 */

/** The field an issue is shown on, from the first part of its path in the spec */
const FIELD_OF: Record<string, ChartField> = {
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
  x: 'rows',
  rowNotes: 'rows',
  mode: 'mode',
  unitNote: 'unitNote',
  groups: 'groups',
}
/** Where a rule about the whole chart (no path) is shown, per kind */
const WHOLE_CHART_FIELD = { bar: 'bars', stacked: 'rows', units: 'groups' } as const

export type ChartField =
  | 'kind'
  | 'title'
  | 'summary'
  | 'unit'
  | 'asOf'
  | 'certainty'
  | 'sources'
  | 'finePrint'
  | 'scaleMax'
  | 'bars'
  | 'series'
  | 'rows'
  | 'mode'
  | 'unitNote'
  | 'groups'

const fieldOf = (issue: ChartIssue, kind: keyof typeof WHOLE_CHART_FIELD): ChartField => {
  // The numbers of a stacked chart are typed in its rows, though the spec keeps them in the series
  if (issue.path[0] === 'series' && issue.path[2] === 'values') return 'rows'
  return FIELD_OF[String(issue.path[0] ?? '')] ?? WHOLE_CHART_FIELD[kind]
}

/** Where in the editor's rows an issue is, from its path in the spec; null for a plain field */
function where(path: ChartIssue['path']): string | null {
  const [head, i, tail, j] = path
  const n = (index: unknown) => Number(index) + 1
  switch (head) {
    case 'data':
      return typeof i === 'number' ? `Bar ${n(i)}` : null
    case 'x':
    case 'rowNotes':
      return typeof i === 'number' ? `Bar ${n(i)}` : null
    case 'series':
      return tail === 'values' ? `Bar ${n(j)}, number ${n(i)}` : `Part ${n(i)}`
    case 'groups':
      return typeof i === 'number'
        ? `Group ${n(i)}${tail === 'data' ? `, part ${n(j)}` : ''}`
        : null
    default:
      return null
  }
}

/** One issue in the editor's words: where it is, then what is wrong */
function describe(issue: ChartIssue): string {
  const message = issue.message.replace(
    /^Invalid input: expected number, received NaN$/,
    'enter a number',
  )
  const place = where(issue.path)
  return place ? `${place}: ${message}` : message
}

/** What is wrong with a chart's `field`, or true. Reads the whole block from the field's siblings. */
export function chartFieldError(field: ChartField, block: unknown): true | string {
  const stored = block as StoredChart
  if (!stored.kind) return true
  const issues = chartIssues(toChartSpecInput(stored)).filter(
    (issue) => fieldOf(issue, stored.kind as keyof typeof WHOLE_CHART_FIELD) === field,
  )
  return issues.length === 0 ? true : issues.map(describe).join('; ')
}

type Validate<V, A> = (value: V, args: A) => true | string | Promise<true | string>

/**
 * Payload's own validation for the field (required, row counts) first, then the chart rules.
 * Fields in other kinds' conditions are not validated while hidden, so only the chosen kind speaks.
 */
export function checked<V, A extends { siblingData: unknown }>(
  field: ChartField,
  own: Validate<V, A>,
): (value: V, args: A) => Promise<true | string> {
  return async (value, args) => {
    const first = await own(value, args)
    return first === true ? chartFieldError(field, args.siblingData) : first
  }
}
