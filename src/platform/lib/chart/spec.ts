import { z } from 'zod'

import { CERTAINTIES } from '@/platform/lib/certainty'
import { isLinkAddress, LINK_ADDRESS_HINT } from '@/platform/lib/linkAddress'

/*
 * What a chart is, as plain data (#639, #592): no React and no chart library, so any adapter can
 * draw it, a module's domain can build one, and an editor's block can store one. `parseChartSpec`
 * is the one gate: a chart that fails it is refused with the reason, never drawn wrongly.
 */

export const CHART_UNITS = ['usd', 'percent', 'mills', 'count'] as const
export type ChartUnit = (typeof CHART_UNITS)[number]

/**
 * The colour set a chart is drawn in (#856): the usual one (`chart-1` to `chart-6`), or `warm`,
 * orange and gray. A theme sets each set's colours; the chart only names which one.
 */
export const CHART_PALETTES = ['default', 'warm'] as const
export type ChartPaletteName = (typeof CHART_PALETTES)[number]

/** Colours a chart can use (`chart-1` to `chart-6`). Slot = position + 1, and a colour never repeats. */
export const MAX_COLOURED_PARTS = 6
/** Squares in a "per hundred" grid */
export const SQUARES_PER_HUNDRED = 100
/** A group's printed total may differ from the sum of its parts by this much (rounding) */
export const TOTAL_TOLERANCE = 1

/**
 * Every size limit of a chart, defined once: the schema below and the editor's block fields
 * (`richtext/editorial/chart*Fields.ts`) both read these, so what the editor saves is what the
 * spec accepts.
 */
export const CHART_LIMITS = {
  /** Rows of a bar chart or stacked chart, parts of a row of tiles */
  rows: 12,
  /** Parts of a grid, and series of a stacked chart: one chart colour each */
  parts: MAX_COLOURED_PARTS,
  groups: 2,
  /** Areas of a breakdown: one step of the seven-step ramp each */
  areas: 7,
  /** Pieces inside one area of a breakdown */
  pieces: 8,
  /** Squares in a breakdown's grid: more would not fit a phone */
  squares: 200,
  sources: 4,
  key: 40,
  label: 80,
  title: 120,
  summary: 400,
  asOf: 120,
  finePrint: 400,
  sourceLabel: 120,
  sourceHref: 500,
  unitNote: 300,
  rowNote: 120,
} as const

const MAX_ROWS = CHART_LIMITS.rows

const text = (max: number) => z.string().trim().min(1).max(max)

const datumSchema = z.object({
  key: text(CHART_LIMITS.key),
  label: text(CHART_LIMITS.label),
  value: z.number().finite().nonnegative(),
  /** Hatched marks read by pattern as well as colour (a proposed amount, an increase) */
  pattern: z.literal('hatch').optional(),
})

const sourceSchema = z.object({
  label: text(CHART_LIMITS.sourceLabel),
  href: text(CHART_LIMITS.sourceHref).refine(isLinkAddress, { message: LINK_ADDRESS_HINT }),
})

const baseShape = {
  title: text(CHART_LIMITS.title),
  /** The takeaway in words: shown under the title */
  summary: text(CHART_LIMITS.summary),
  unit: z.enum(CHART_UNITS),
  /** The colour set: left out means the usual one */
  palette: z.enum(CHART_PALETTES).optional(),
  /** When the figures are from, such as "Mayor's proposal, October 2026" */
  asOf: text(CHART_LIMITS.asOf).optional(),
  certainty: z.enum(CERTAINTIES).optional(),
  sources: z.array(sourceSchema).max(CHART_LIMITS.sources).optional(),
  finePrint: text(CHART_LIMITS.finePrint).optional(),
}

const orientation = z.enum(['horizontal', 'vertical'])

const dataList = (max: number) =>
  z
    .array(datumSchema)
    .min(1)
    .max(max)
    .superRefine((data, ctx) => {
      const seen = new Map<string, string>()
      data.forEach((d, i) => {
        const first = seen.get(d.key)
        if (first !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'key'],
            message: `The key "${d.key}" is used twice: "${d.label}" repeats the key of "${first}"`,
          })
        } else seen.set(d.key, d.label)
      })
    })

const groupSchema = z.object({
  key: text(CHART_LIMITS.key),
  label: text(CHART_LIMITS.label),
  /** The whole the parts add up to, if the chart states it */
  total: z.number().finite().nonnegative().optional(),
  data: dataList(MAX_ROWS),
})

const unitsSchema = z
  .object({
    ...baseShape,
    kind: z.literal('units'),
    /** `perHundred`: 100 squares share out each group's total. `each`: one tile per part. */
    mode: z.enum(['perHundred', 'each']),
    /** What one square or tile stands for, in a sentence */
    unitNote: text(CHART_LIMITS.unitNote),
    groups: z.array(groupSchema).min(1).max(CHART_LIMITS.groups),
  })
  .superRefine((spec, ctx) => {
    if (spec.mode === 'perHundred' && spec.unit !== 'usd') {
      ctx.addIssue({
        code: 'custom',
        message: 'A perHundred grid shares out dollars, so its unit must be dollars (usd)',
        path: ['unit'],
      })
    }
    for (const group of spec.groups) {
      const sum = group.data.reduce((total, d) => total + d.value, 0)
      const issue = (message: string) => ctx.addIssue({ code: 'custom', message, path: ['groups'] })
      if (spec.mode === 'perHundred') {
        if (group.data.length > MAX_COLOURED_PARTS) {
          issue(
            `${group.label}: a grid shows at most ${MAX_COLOURED_PARTS} parts, so fold the rest into "Other"`,
          )
        }
        if (sum <= 0)
          issue(`${group.label}: the parts add up to zero, so no square could be filled`)
      }
      if (group.total !== undefined && Math.abs(group.total - sum) > TOTAL_TOLERANCE) {
        issue(
          `${group.label}: the total ${group.total} is not within ${TOTAL_TOLERANCE} of its parts (${sum})`,
        )
      }
    }
  })

const areaSchema = z.object({
  key: text(CHART_LIMITS.key),
  label: text(CHART_LIMITS.label),
  value: z.number().finite().positive(),
  /** The smaller parts of this area: shown under it, or in the list of smaller pieces */
  pieces: z
    .array(
      z.object({
        key: text(CHART_LIMITS.key),
        label: text(CHART_LIMITS.label),
        value: z.number().finite().positive(),
        /** Shown right under its area, not folded into the list of smaller pieces */
        shown: z.literal(true).optional(),
      }),
    )
    .max(CHART_LIMITS.pieces)
    .optional(),
})

const breakdownSchema = z
  .object({
    ...baseShape,
    kind: z.literal('breakdown'),
    /** What one square of the grid stands for, in dollars */
    squareValue: z.number().finite().positive(),
    areas: z.array(areaSchema).min(1).max(CHART_LIMITS.areas),
  })
  .superRefine((spec, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) =>
      ctx.addIssue({ code: 'custom', message, path })
    if (spec.unit !== 'usd') {
      issue('A breakdown shares out dollars, so its unit must be dollars (usd)', ['unit'])
    }
    const seen = new Map<string, string>()
    const claim = (key: string, label: string, path: (string | number)[]) => {
      const first = seen.get(key)
      if (first === undefined) seen.set(key, label)
      else issue(`The key "${key}" is used twice: "${label}" repeats the key of "${first}"`, path)
    }
    spec.areas.forEach((area, i) => {
      claim(area.key, area.label, ['areas', i, 'key'])
      area.pieces?.forEach((piece, j) =>
        claim(piece.key, piece.label, ['areas', i, 'pieces', j, 'key']),
      )
      const inside = (area.pieces ?? []).reduce((sum, piece) => sum + piece.value, 0)
      if (inside > area.value + TOTAL_TOLERANCE) {
        issue(`${area.label}: its pieces add up to more than the area itself`, ['areas', i])
      }
    })
    const squares = Math.round(
      spec.areas.reduce((sum, area) => sum + area.value, 0) / spec.squareValue,
    )
    if (squares > CHART_LIMITS.squares) {
      issue(
        `A square this small makes a grid of ${squares} squares: at most ${CHART_LIMITS.squares} fit, so make each square worth more`,
        ['squareValue'],
      )
    } else if (squares < spec.areas.length) {
      issue(
        `A square this big makes a grid of ${squares} squares for ${spec.areas.length} areas: make each square worth less`,
        ['squareValue'],
      )
    }
  })

const SCALE_MAX_MESSAGE = 'scaleMax is shorter than the longest bar, so that bar would not fit'
/** Sums of decimals can land a hair over the scale (0.1 + 0.2 > 0.3), so compare with a relative margin */
const SCALE_TOLERANCE = 1e-9
const fitsScale = (scaleMax: number | undefined, longest: number) =>
  scaleMax === undefined || longest <= scaleMax * (1 + SCALE_TOLERANCE)

const barSchema = z
  .object({
    ...baseShape,
    kind: z.literal('bar'),
    orientation,
    /** The scale's end: charts with the same scaleMax draw the same value the same length */
    scaleMax: z.number().positive().optional(),
    data: dataList(MAX_ROWS),
  })
  .refine((spec) => fitsScale(spec.scaleMax, Math.max(...spec.data.map((d) => d.value))), {
    message: SCALE_MAX_MESSAGE,
    path: ['scaleMax'],
  })

const seriesSchema = z.object({
  key: text(CHART_LIMITS.key),
  label: text(CHART_LIMITS.label),
  pattern: z.literal('hatch').optional(),
  /** An amount added on top of the first one: its value reads "+$24.8M" */
  increase: z.literal(true).optional(),
  values: z.array(z.number().finite().nonnegative()).min(1).max(MAX_ROWS),
})

const stackedSchema = z
  .object({
    ...baseShape,
    kind: z.literal('stacked'),
    orientation,
    /** The rows (or columns) the series are stacked in, such as years */
    x: z.array(text(CHART_LIMITS.label)).min(1).max(MAX_ROWS),
    series: z.array(seriesSchema).min(1).max(CHART_LIMITS.parts),
    scaleMax: z.number().positive().optional(),
    /** One short note per row, such as "$66 of every $100 is borrowed" */
    rowNotes: z.array(text(CHART_LIMITS.rowNote)).max(MAX_ROWS).optional(),
  })
  .superRefine((spec, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (spec.series.some((s) => s.values.length !== spec.x.length)) {
      add('Every series needs one value for each of the rows')
    }
    if (spec.rowNotes && spec.rowNotes.length !== spec.x.length)
      add('Give a note for every row, or none')
    const longest = Math.max(
      ...spec.x.map((_, i) => spec.series.reduce((t, s) => t + (s.values[i] ?? 0), 0)),
    )
    if (!fitsScale(spec.scaleMax, longest)) add(SCALE_MAX_MESSAGE)
  })

export const chartSpecSchema = z.discriminatedUnion('kind', [
  unitsSchema,
  barSchema,
  stackedSchema,
  breakdownSchema,
])

export type ChartSpec = z.infer<typeof chartSpecSchema>
export type ChartKind = ChartSpec['kind']
export const CHART_KINDS = [
  'units',
  'bar',
  'stacked',
  'breakdown',
] as const satisfies readonly ChartKind[]

/** The one gate: returns the spec, or throws with every reason it is refused */
export function parseChartSpec(input: unknown): ChartSpec {
  return chartSpecSchema.parse(input)
}
