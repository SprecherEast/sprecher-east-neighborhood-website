'use client'

import React from 'react'

import { Zoom } from '@/platform/ui/Zoom.client'
import { CHART_LARGE_WIDTH } from '@/platform/ui/layoutSizes'

import { CHART_DRAWING_SELECTOR } from './chartDrawing'

export type ChartZoomProps = {
  /** The chart's title: names the button and the dialog */
  title: string
  /** The server-rendered chart. It is in the page, or in the dialog while it is open, never both */
  children: React.ReactNode
}

/**
 * Lets a reader enlarge a chart (#681). The chart is a thumbnail in the page; "Enlarge", or a click
 * or tap on the drawing, opens the same server-rendered chart in the shared `Zoom` (#815), so there
 * is one drawing, one set of ids and one data table at any moment, and no picture is made. The
 * chart's layout reads this wrapper's width (`@container/chart`), here and in the dialog. This is
 * the only client code of the chart: it imports no chart library.
 */
export function ChartZoom({ title, children }: ChartZoomProps) {
  return (
    <Zoom
      title={title}
      kind="chart"
      pointerSelector={CHART_DRAWING_SELECTOR}
      className="@container/chart"
      bodyClassName={`@container/chart ${CHART_LARGE_WIDTH}`}
      holderClassName="scripted:[&_[data-chart-drawing]]:cursor-zoom-in"
      buttonClassName="@2xl/chart:absolute @2xl/chart:top-0 @2xl/chart:right-0"
    >
      {children}
    </Zoom>
  )
}
