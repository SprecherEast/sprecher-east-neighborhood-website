'use client'

import { Maximize2 } from 'lucide-react'
import React, { useRef, useState } from 'react'

import { cn } from '@/platform/lib/cn'
import { Button } from '@/platform/ui/Button'
import { Dialog } from '@/platform/ui/Dialog.client'

import { ChartLayout, type ChartParts } from './ChartLayout'

/** The page's box keeps the chart's height while the chart is in the dialog, so nothing jumps */
export const CHART_ZOOM_HEIGHT_VAR = '--chart-zoom-height'
export const CHART_ZOOM_KEEP_HEIGHT = 'min-h-[var(--chart-zoom-height,0px)]'

export type ChartZoomProps = ChartParts & {
  /** Names the dialog and the Enlarge button */
  title: string
  className?: string
}

/**
 * Lets a reader see a chart bigger (#681): the chart as a thumbnail with an Enlarge button, and the
 * same chart in the kit's modal `Dialog` when it is opened. Opening moves the chart's pieces, which
 * the server drew, out of the page and into the dialog, so the chart is in the page once at any
 * moment (one drawing, one set of ids, one table) and nothing is drawn or fetched twice. A box the
 * chart's height stays behind. The picture is the same svg or HTML in both sizes, never a raster.
 * The only client code here is this open-and-close state: no chart library reaches the browser.
 */
export function ChartZoom({ title, head, drawing, details, numbers, className }: ChartZoomProps) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  function change(next: boolean) {
    // Measured as it opens and cleared as it closes. It can go stale if the window is resized while
    // the dialog is open, which no one sees: the sheet covers the page, and it is cleared on close
    if (next) {
      box.current?.style.setProperty(CHART_ZOOM_HEIGHT_VAR, `${box.current.offsetHeight}px`)
    } else box.current?.style.removeProperty(CHART_ZOOM_HEIGHT_VAR)
    setOpen(next)
  }

  return (
    <ChartLayout
      ref={box}
      className={cn(CHART_ZOOM_KEEP_HEIGHT, className)}
      // While it is open the pieces are in the dialog; the Enlarge button stays, so focus can return
      {...(open
        ? {}
        : {
            head,
            drawing: <ZoomTarget onOpen={() => change(true)}>{drawing}</ZoomTarget>,
            details,
            numbers,
          })}
      action={
        <Dialog
          open={open}
          onOpenChange={change}
          title={title}
          hideTitle
          trigger={
            <Button
              variant="secondary"
              size="sm"
              iconStart={<Maximize2 aria-hidden="true" />}
              aria-label={`Enlarge chart: ${title}`}
              // Without scripting the button does nothing, so it only shows with scripting on
              className="hidden scripted:inline-flex"
            >
              Enlarge
            </Button>
          }
        >
          <div className="container py-8">
            <ChartLayout
              variant="enlarged"
              head={head}
              drawing={drawing}
              details={details}
              numbers={numbers}
            />
          </div>
        </Dialog>
      }
    />
  )
}

/**
 * A click or tap on the drawing opens it too. This is a convenience for pointers only: the Enlarge
 * button is the way in for the keyboard and for assistive technology, so the drawing is not made a
 * second control.
 */
function ZoomTarget({ onOpen, children }: { onOpen: () => void; children: React.ReactNode }) {
  return (
    <div
      // Selecting the chart's text ends in a click: that is a reader copying it, not asking to enlarge
      onClick={() => {
        if (!window.getSelection()?.toString()) onOpen()
      }}
      className="scripted:cursor-zoom-in"
    >
      {children}
    </div>
  )
}
