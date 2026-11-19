import type { Block } from 'payload'

import { chartBaseFields } from './chartBaseFields'
import { chartDataFields } from './chartDataFields'
import type { StoredChart } from './chart'
import { chartToJsx, importChartTag } from './chartMarkdown'

/**
 * The chart an editor puts inside rich text (#640): a title, the takeaway in words, a kind, the
 * unit, and rows of numbers for that kind (`bars`, `series` with `rows`, or `groups` of parts).
 * Saving checks the chart with the `ChartSpec` rules (`chartValidate.ts`); `toChartSpec()` turns
 * the stored fields into the spec `Chart` draws. The `jsx` converter writes it as one
 * `<Chart … />` tag in Markdown and reads such a tag back, for agents.
 */
export const ChartBlockConfig: Block = {
  slug: 'chart',
  interfaceName: 'ChartBlock',
  labels: { singular: 'Chart', plural: 'Charts' },
  fields: [...chartBaseFields(), ...chartDataFields()],
  jsx: {
    // Payload types a block's fields loosely; these are the fields declared above
    export: ({ fields }) => chartToJsx(fields as StoredChart),
    import: ({ props }) => importChartTag(props),
  },
}
