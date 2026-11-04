'use client'

import { Maximize2 } from 'lucide-react'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Button } from '@/platform/ui/Button'
import { Dialog } from '@/platform/ui/Dialog.client'
import { CHART_LARGE_WIDTH } from '@/platform/ui/layoutSizes'

export type ChartZoomProps = {
  /** The chart's title: names the button and the dialog */
  title: string
  /** The server-rendered chart. It is in the page, or in the dialog while it is open, never both */
  children: React.ReactNode
}

/** What a click on the drawing itself opens from: `Chart` marks the drawing with this attribute */
const DRAWING = '[data-chart-drawing]'

/**
 * Lets a reader enlarge a chart (#681). The chart is a thumbnail in the page; "Enlarge", or a click
 * or tap on the drawing, opens the same server-rendered chart in the kit's `Dialog` (focus trap,
 * Escape, scroll lock, focus back to the button). The chart moves rather than being copied, so
 * there is one drawing, one set of ids and one data table at any moment, and no picture is made.
 * The chart's layout reads this component's width (`@container/chart`), here and in the dialog.
 * An empty box of the same height keeps the page from collapsing behind the dialog. With scripting
 * off the button is hidden and the chart simply stays at its thumbnail size. This is the only
 * client code of the chart: it imports no chart library.
 */
export function ChartZoom({ title, children }: ChartZoomProps) {
  const [open, setOpen] = useState(false)
  const holder = useRef<HTMLDivElement>(null)
  const height = useRef(0)

  const change = (next: boolean) => {
    if (next) height.current = holder.current?.offsetHeight ?? 0
    setOpen(next)
  }

  // The empty box keeps the chart's height; a plain assignment, as the height is only known here
  useLayoutEffect(() => {
    if (holder.current) holder.current.style.height = open ? `${height.current}px` : ''
  }, [open])

  // A pointer shortcut: the button is the keyboard and screen reader path
  useEffect(() => {
    const element = holder.current
    if (!element || open) return
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(DRAWING)) change(true)
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [open])

  return (
    <div className="@container/chart relative flex flex-col gap-2">
      <Dialog
        open={open}
        onOpenChange={change}
        title={title}
        hideTitle
        trigger={
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Enlarge chart: ${title}`}
            className="hidden self-end lg:min-h-11 lg:px-4 @2xl/chart:absolute @2xl/chart:top-0 @2xl/chart:right-0 scripted:inline-flex"
            iconStart={<Maximize2 aria-hidden="true" />}
          >
            Enlarge
          </Button>
        }
      >
        <div className="container py-8">
          <div className={`@container/chart mx-auto ${CHART_LARGE_WIDTH}`}>{children}</div>
        </div>
      </Dialog>
      <div
        ref={holder}
        data-chart-zoom-holder
        aria-hidden={open || undefined}
        className="w-full [&_[data-chart-drawing]]:cursor-zoom-in"
      >
        {open ? null : children}
      </div>
    </div>
  )
}
