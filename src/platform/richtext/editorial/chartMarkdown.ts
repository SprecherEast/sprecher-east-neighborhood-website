import { chartIssues, describeChartIssues, type ChartIssue } from '@/platform/lib/chart/issues'
import {
  CHART_KINDS,
  parseChartSpec,
  type ChartKind,
  type ChartSpec,
} from '@/platform/lib/chart/spec'

import { importOrRefuse, readText, refusalPrefix, writeProp } from './editorialTag'
import { fromChartSpec, isEnlargeable, toChartSpec, type StoredChart } from './chart'

/**
 * The chart block as one Markdown tag (#640), for agents: Payload's block `jsx` converter writes
 * `<Chart kind="bar" title="…" summary="…" unit="usd" data={[…]} />` and reads it back, and both
 * ways go through the `ChartSpec` rules. A tag that breaks them is refused with the reasons, so
 * `submitSuggestion` can hand them back to the agent.
 */

/** The one prop that is not part of the drawing: written only when off (#686) */
const ENLARGE = 'enlarge'
const COMMON = [
  'kind',
  'title',
  'summary',
  'unit',
  'palette',
  'asOf',
  'certainty',
  'sources',
  'finePrint',
  ENLARGE,
]
/** The props each kind takes, in the order they are written (the long arrays last) */
const PROPS: Record<ChartKind, readonly string[]> = {
  bar: [...COMMON, 'scaleMax', 'data'],
  stacked: [...COMMON, 'scaleMax', 'x', 'series', 'rowNotes'],
  units: [...COMMON, 'mode', 'unitNote', 'groups'],
  breakdown: [...COMMON, 'squareValue', 'hideSquares', 'areas'],
}
/** Charts are drawn horizontally only for now, so the tag has no orientation to write */
const ORIENTATION = 'orientation'
const PROP_NAME = /^[A-Za-z][A-Za-z0-9]*$/
const isKind = (value: unknown): value is ChartKind =>
  (CHART_KINDS as readonly unknown[]).includes(value)

/** The props a valid chart writes into a tag (or into a fact tab's panel), in the order written */
export function chartSpecTagProps(spec: ChartSpec, enlarge = true): Record<string, unknown> {
  const values: Record<string, unknown> = { ...spec, [ENLARGE]: enlarge ? undefined : 'false' }
  return Object.fromEntries(
    PROPS[spec.kind].flatMap((name) => (values[name] === undefined ? [] : [[name, values[name]]])),
  )
}

/** The same for a stored chart, or false when it is not valid (it is left out) */
export function chartTagProps(fields: StoredChart): Record<string, unknown> | false {
  try {
    return chartSpecTagProps(toChartSpec(fields), isEnlargeable(fields))
  } catch {
    return false
  }
}

/** The block as its Markdown tag, or false when the stored chart is not valid (it is left out) */
export function chartToJsx(fields: StoredChart): string | false {
  const props = chartTagProps(fields)
  if (!props) return false
  return `<Chart ${Object.entries(props)
    .map(([name, value]) => writeProp(name, value))
    .join(' ')} />`
}

/** `enlarge` as the tag gives it: the text "true" or "false" (a fact tab's JSON may use a boolean) */
const enlargeValue = (value: unknown): boolean | undefined =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : undefined

const unquote = (value: unknown) => (typeof value === 'string' ? readText(value) : value)

/** What is wrong with the tag's props beyond the chart's own rules: unknown props, a vertical chart */
function tagIssues(props: Record<string, unknown>): ChartIssue[] {
  const kind = props.kind
  if (!isKind(kind)) return []
  const known = new Set([
    ...PROPS[kind],
    ...(kind === 'units' || kind === 'breakdown' ? [] : [ORIENTATION]),
  ])
  const issues: ChartIssue[] = Object.keys(props)
    .filter((name) => !known.has(name))
    .map((name) => ({
      path: [],
      message: PROP_NAME.test(name)
        ? `${name} is not a property of a ${kind} chart (use ${PROPS[kind].join(', ')})`
        : `the tag could not be read near "${name.slice(0, 20)}": check that quotes, braces and brackets inside text are written as \\u0022, \\u007b, \\u007d, \\u005b and \\u005d`,
    }))
  if (props[ENLARGE] !== undefined && enlargeValue(props[ENLARGE]) === undefined) {
    issues.push({
      path: [ENLARGE],
      message: 'enlarge must be "true" or "false" (leave it out to let readers enlarge the chart)',
    })
  }
  if (props[ORIENTATION] !== undefined && props[ORIENTATION] !== 'horizontal') {
    issues.push({
      path: [ORIENTATION],
      message: 'vertical charts are not drawn yet: leave orientation out (it is horizontal)',
    })
  }
  return issues
}

/**
 * Every reason the props (text already read) are not a valid chart: unknown props and a vertical
 * chart first, then the chart's own rules. One definition for the `<Chart>` tag and for a chart
 * inside a fact tab.
 */
export function chartTagIssues(read: Record<string, unknown>): ChartIssue[] {
  // The drawing is horizontal, so a tag needs no orientation: the spec gets it here
  const { [ENLARGE]: _enlarge, ...drawing } = read
  return [...tagIssues(read), ...chartIssues({ ...drawing, orientation: 'horizontal' })]
}

/** The block's fields for props that passed `chartTagIssues` (text already read) */
export function chartFromProps(read: Record<string, unknown>): StoredChart {
  const { [ENLARGE]: enlarge, ...drawing } = read
  const stored = fromChartSpec(parseChartSpec({ ...drawing, orientation: 'horizontal' }))
  return enlargeValue(enlarge) === false ? { ...stored, enlarge: false } : stored
}

/**
 * The block's fields for a tag's props. Throws `Invalid <Chart>: …` with every reason when the
 * props are not a valid chart: payload turns the error into the agent's answer.
 */
export function chartFromJsx(props: Record<string, unknown>): StoredChart {
  const read = Object.fromEntries(
    Object.entries(props).map(([name, value]) => [name, unquote(value)]),
  )
  const issues = chartTagIssues(read)
  if (issues.length > 0) throw new Error(`${refusalPrefix('Chart')} ${describeChartIssues(issues)}`)
  return chartFromProps(read)
}

/** `jsx.import`: the block's fields for the tag, or false (and a collected refusal) when it is invalid */
export const importChartTag = (props: Record<string, unknown>): StoredChart | false =>
  importOrRefuse(() => chartFromJsx(props))
