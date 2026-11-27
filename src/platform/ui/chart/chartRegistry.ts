import type { ChartKind } from '@/platform/lib/chart/spec'

import { breakdownAdapter } from './adapters/breakdown/breakdownAdapter'
import { cssAdapter } from './adapters/css/cssAdapter'
import { textAdapter } from './adapters/text/textAdapter'
import { visxAdapter } from './adapters/visx/visxAdapter'
import type { ChartAdapter } from './chartAdapter'

/**
 * The adapters, best first (#639). The first one that supports a kind draws it; the text adapter
 * supports every kind, so it is the last resort. Changing a chart library is a new adapter
 * placed here.
 */
const ADAPTERS: readonly ChartAdapter[] = [breakdownAdapter, cssAdapter, visxAdapter, textAdapter]

export function adapterFor(kind: ChartKind): ChartAdapter {
  return ADAPTERS.find((adapter) => adapter.kinds.has(kind)) ?? textAdapter
}
