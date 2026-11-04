import React from 'react'

import type { ChartAdapter } from '../../chartAdapter'

import { BarChartSvg } from './BarChartSvg'
import { toBarModel } from './barModel'

/**
 * The visx adapter (#663, decision 0018): horizontal bars and stacked bars as one SVG, drawn with
 * visx's scales and shapes on the server. No visx code reaches the browser: the whole tree is a
 * server component, so the client gets markup and no chart JavaScript. This folder is the only
 * place that may import `@visx/*` (lint). Vertical charts are not drawn yet and are refused.
 */
export const visxAdapter: ChartAdapter = {
  name: 'visx',
  output: 'svg',
  kinds: new Set<'bar' | 'stacked'>(['bar', 'stacked']),
  usesColour: true,
  render(spec, context) {
    return <BarChartSvg model={toBarModel(spec)} {...context} />
  },
}
