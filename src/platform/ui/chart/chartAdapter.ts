import type React from 'react'

import type { ChartKind, ChartSpec } from '@/platform/lib/chart/spec'

import type { ChartPalette } from './chartPalette'

/** What the `Chart` gives an adapter to draw with */
export type ChartRenderContext = {
  /** The id of the chart's title: the label of an `img` the adapter draws */
  titleId: string
  /** The id of the chart's description: what the `img` says about itself */
  descId: string
  palette: ChartPalette
}

/**
 * The port every chart drawing goes through (#639, ports and adapters): `Chart` asks the registry
 * for the adapter that supports a spec's kind and never names a library. Swapping a library is a
 * new adapter that passes `describeChartAdapter`, and one line in the registry.
 */
export interface ChartAdapter {
  readonly name: string
  /** `svg`: the adapter draws one `<svg role="img">`. `html`: it draws markup, text or HTML marks. */
  readonly output: 'svg' | 'html'
  readonly kinds: ReadonlySet<ChartKind>
  /** True when marks take the palette's colours, so `Chart` draws the colour key under them */
  readonly usesColour: boolean
  /**
   * A server component tree: no hooks, no `'use client'`, no `style` attribute and no colour
   * literal. Every mark carries `data-chart-mark`.
   */
  render(spec: ChartSpec, context: ChartRenderContext): React.ReactNode
}
