import type { z } from 'zod'

/*
 * The rules of the two compact looks of a chart (#1503), kept apart from the schema so that file
 * stays small: the change-first look of a stacked chart and the compact rows of a bar chart.
 */

/** The slices a change-first chart's slim strip can show: one tone each (`SHARE_TONES`, four) */
export const MAX_CHANGE_PARTS = 4
/** Rows a bar chart shows before the rest wait under "See the smaller pieces" */
export const COMPACT_VISIBLE_ROWS = 8

/** A change-first chart compares two rows, in dollars, and splits the later one in at most four parts */
export function refineChangeLook(
  spec: { look?: string; x: readonly unknown[]; series: readonly unknown[]; unit: string },
  add: (message: string) => void,
) {
  if (spec.look !== 'change') return
  if (spec.x.length !== 2)
    add('A change-first chart compares two rows: the earlier, then the later')
  if (spec.series.length > MAX_CHANGE_PARTS) {
    add(`A change-first strip shows at most ${MAX_CHANGE_PARTS} parts`)
  }
  if (spec.unit !== 'usd') add('A change-first chart shows dollars (usd)')
}

/** Earlier amounts need a name, dollars and the compact rows that show their change */
export function refineCompactBars(
  spec: {
    data: readonly { previous?: number }[]
    previousLabel?: string
    unit: string
    density?: string
  },
  ctx: z.RefinementCtx,
) {
  if (!spec.data.some((d) => d.previous !== undefined)) return
  const add = (message: string, path: string) =>
    ctx.addIssue({ code: 'custom', message, path: [path] })
  if (spec.previousLabel === undefined) {
    add('Say what the earlier numbers are, such as "2026 adopted"', 'previousLabel')
  }
  if (spec.unit !== 'usd') add('A change from an earlier amount is shown in dollars (usd)', 'unit')
  if (spec.density !== 'compact') {
    add('Earlier numbers show in the compact rows, so set the density to compact', 'density')
  }
}
