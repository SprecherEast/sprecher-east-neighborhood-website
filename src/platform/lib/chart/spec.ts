import { z } from 'zod'

import { CERTAINTIES } from '@/platform/lib/certainty'

/*
 * What a chart is, as plain data (#639, #592): no React and no chart library, so any adapter can
 * draw it, a module's domain can build one, and an editor's block can store one. `parseChartSpec`
 * is the one gate: a chart that fails it is refused with the reason, never drawn wrongly.
 */

export const CHART_UNITS = ['usd', 'percent', 'mills', 'count'] as const
export type ChartUnit = (typeof CHART_UNITS)[number]

/** Colours a chart can use (`chart-1` to `chart-6`). Slot = position + 1, and a colour never repeats. */
export const MAX_COLOURED_PARTS = 6
/** Squares in a "per hundred" grid */
export const SQUARES_PER_HUNDRED = 100
/** A group's printed total may differ from the sum of its parts by this much (rounding) */
export const TOTAL_TOLERANCE = 1
const MAX_ROWS = 12

const text = (max: number) => z.string().trim().min(1).max(max)

const datumSchema = z.object({
  key: text(40),
  label: text(80),
  value: z.number().finite().nonnegative(),
  /** Hatched marks read by pattern as well as colour (a proposed amount, an increase) */
  pattern: z.literal('hatch').optional(),
})

const sourceSchema = z.object({ label: text(120), href: text(500) })

const baseShape = {
  title: text(120),
  /** The takeaway in words: shown under the title */
  summary: text(400),
  unit: z.enum(CHART_UNITS),
  /** When the figures are from, such as "Mayor's proposal, October 2026" */
  asOf: text(120).optional(),
  certainty: z.enum(CERTAINTIES).optional(),
  sources: z.array(sourceSchema).max(4).optional(),
  finePrint: text(400).optional(),
}

const orientation = z.enum(['horizontal', 'vertical'])

const dataList = (max: number) =>
  z
    .array(datumSchema)
    .min(1)
    .max(max)
    .refine((data) => new Set(data.map((d) => d.key)).size === data.length, {
      message: 'A part appears twice: each key can be used once',
    })

const groupSchema = z.object({
  key: text(40),
  label: text(80),
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
    unitNote: text(300),
    groups: z.array(groupSchema).min(1).max(2),
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

const barSchema = z.object({
  ...baseShape,
  kind: z.literal('bar'),
  orientation,
  /** The longest bar's length stands for this much, so bars in different charts compare */
  scaleMax: z.number().positive().optional(),
  data: dataList(MAX_ROWS),
})

const seriesSchema = z.object({
  key: text(40),
  label: text(80),
  pattern: z.literal('hatch').optional(),
  values: z.array(z.number().finite().nonnegative()).min(1).max(MAX_ROWS),
})

const stackedSchema = z
  .object({
    ...baseShape,
    kind: z.literal('stacked'),
    orientation,
    /** The rows (or columns) the series are stacked in, such as years */
    x: z.array(text(80)).min(1).max(MAX_ROWS),
    series: z.array(seriesSchema).min(1).max(MAX_COLOURED_PARTS),
    scaleMax: z.number().positive().optional(),
    /** One short note per row, such as "$66 of every $100 is borrowed" */
    rowNotes: z.array(text(120)).max(MAX_ROWS).optional(),
  })
  .superRefine((spec, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (spec.series.some((s) => s.values.length !== spec.x.length)) {
      add('Every series needs one value for each of the rows')
    }
    if (spec.rowNotes && spec.rowNotes.length !== spec.x.length)
      add('Give a note for every row, or none')
  })

export const chartSpecSchema = z.discriminatedUnion('kind', [unitsSchema, barSchema, stackedSchema])

export type ChartSpec = z.infer<typeof chartSpecSchema>
export type ChartKind = ChartSpec['kind']
export const CHART_KINDS = ['units', 'bar', 'stacked'] as const satisfies readonly ChartKind[]

/** The one gate: returns the spec, or throws with every reason it is refused */
export function parseChartSpec(input: unknown): ChartSpec {
  return chartSpecSchema.parse(input)
}
