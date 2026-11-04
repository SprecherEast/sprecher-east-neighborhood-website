import { chartIssues, describeChartIssues, type ChartIssue } from '@/platform/lib/chart/issues'
import {
  CHART_KINDS,
  parseChartSpec,
  type ChartKind,
  type ChartSpec,
} from '@/platform/lib/chart/spec'

import { readText, writeProp } from './chartTag'
import { fromChartSpec, toChartSpec, type StoredChart } from './chart'

/**
 * The chart block as one Markdown tag (#640), for agents: Payload's block `jsx` converter writes
 * `<Chart kind="bar" title="…" summary="…" unit="usd" data={[…]} />` and reads it back, and both
 * ways go through the `ChartSpec` rules. A tag that breaks them is refused with the reasons, so
 * `submitSuggestion` can hand them back to the agent.
 */

const COMMON = ['kind', 'title', 'summary', 'unit', 'asOf', 'certainty', 'sources', 'finePrint']
/** The props each kind takes, in the order they are written (the long arrays last) */
const PROPS: Record<ChartKind, readonly string[]> = {
  bar: [...COMMON, 'scaleMax', 'data'],
  stacked: [...COMMON, 'scaleMax', 'x', 'series', 'rowNotes'],
  units: [...COMMON, 'mode', 'unitNote', 'groups'],
}
/** Charts are drawn horizontally only for now, so the tag has no orientation to write */
const ORIENTATION = 'orientation'
const PROP_NAME = /^[A-Za-z][A-Za-z0-9]*$/
const isKind = (value: unknown): value is ChartKind =>
  (CHART_KINDS as readonly unknown[]).includes(value)

/** The block as its Markdown tag, or false when the stored chart is not valid (it is left out) */
export function chartToJsx(fields: StoredChart): string | false {
  let spec: ChartSpec
  try {
    spec = toChartSpec(fields)
  } catch {
    return false
  }
  const values: Record<string, unknown> = spec
  const props = Object.fromEntries(
    PROPS[spec.kind].flatMap((name) => (values[name] === undefined ? [] : [[name, values[name]]])),
  )
  return `<Chart ${Object.entries(props)
    .map(([name, value]) => writeProp(name, value))
    .join(' ')} />`
}

const unquote = (value: unknown) => (typeof value === 'string' ? readText(value) : value)

/** What is wrong with the tag's props beyond the chart's own rules: unknown props, a vertical chart */
function tagIssues(props: Record<string, unknown>): ChartIssue[] {
  const kind = props.kind
  if (!isKind(kind)) return []
  const known = new Set([...PROPS[kind], ...(kind === 'units' ? [] : [ORIENTATION])])
  const issues: ChartIssue[] = Object.keys(props)
    .filter((name) => !known.has(name))
    .map((name) => ({
      path: [],
      message: PROP_NAME.test(name)
        ? `${name} is not a property of a ${kind} chart (use ${PROPS[kind].join(', ')})`
        : `the tag could not be read near "${name.slice(0, 20)}": check that quotes, braces and brackets inside text are written as \\u0022, \\u007b, \\u007d, \\u005b and \\u005d`,
    }))
  if (props[ORIENTATION] !== undefined && props[ORIENTATION] !== 'horizontal') {
    issues.push({
      path: [ORIENTATION],
      message: 'vertical charts are not drawn yet: leave orientation out (it is horizontal)',
    })
  }
  return issues
}

/**
 * The block's fields for a tag's props. Throws `Invalid <Chart>: …` with every reason when the
 * props are not a valid chart: payload turns the error into the agent's answer.
 */
export function chartFromJsx(props: Record<string, unknown>): StoredChart {
  const read = Object.fromEntries(
    Object.entries(props).map(([name, value]) => [name, unquote(value)]),
  )
  // The drawing is horizontal, so a tag needs no orientation: the spec gets it here
  const input = { ...read, orientation: 'horizontal' }
  const issues = [...tagIssues(read), ...chartIssues(input)]
  if (issues.length > 0) throw new Error(`Invalid <Chart>: ${describeChartIssues(issues)}`)
  return fromChartSpec(parseChartSpec(input))
}

/**
 * Payload's Markdown converter runs inside a Lexical editor, which logs an error an import throws
 * and carries on, so the caller would never hear why a tag was refused. While `run` converts,
 * the refusals of its `<Chart>` tags are collected here instead, and those tags are left as text:
 * the caller turns them into the answer. Conversion is synchronous, so one list at a time is safe.
 */
let collecting: string[] | null = null

export function collectChartRefusals<T>(run: () => T): { value: T; refusals: string[] } {
  const outer = collecting
  const refusals: string[] = []
  collecting = refusals
  try {
    return { value: run(), refusals }
  } finally {
    collecting = outer
  }
}

/** `jsx.import`: the block's fields for the tag, or false (and a collected refusal) when it is invalid */
export function importChartTag(props: Record<string, unknown>): StoredChart | false {
  try {
    return chartFromJsx(props)
  } catch (error) {
    if (!collecting) throw error
    collecting.push(error instanceof Error ? error.message : String(error))
    return false
  }
}
