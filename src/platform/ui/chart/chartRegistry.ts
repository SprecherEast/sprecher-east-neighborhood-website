import type { ChartSpec } from '@/platform/lib/chart/spec'

import { breakdownAdapter } from './adapters/breakdown/breakdownAdapter'
import { changeAdapter } from './adapters/change/changeAdapter'
import { cssAdapter } from './adapters/css/cssAdapter'
import { rowsAdapter } from './adapters/rows/rowsAdapter'
import { textAdapter } from './adapters/text/textAdapter'
import { visxAdapter } from './adapters/visx/visxAdapter'
import type { ChartAdapter } from './chartAdapter'

/**
 * The adapters, best first (#639). The first one that supports a spec's kind, and accepts the spec
 * (a look of that kind, #1503), draws it; the text adapter supports every kind, so it is the last
 * resort. Changing a chart library is a new adapter
 * placed here.
 */
const ADAPTERS: readonly ChartAdapter[] = [
  breakdownAdapter,
  changeAdapter,
  rowsAdapter,
  cssAdapter,
  visxAdapter,
  textAdapter,
]

export function adapterFor(spec: ChartSpec): ChartAdapter {
  return (
    ADAPTERS.find((adapter) => adapter.kinds.has(spec.kind) && (adapter.accepts?.(spec) ?? true)) ??
    textAdapter
  )
}
