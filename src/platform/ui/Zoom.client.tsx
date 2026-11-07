'use client'

import { Maximize2 } from 'lucide-react'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/platform/lib/cn'

import { Button } from './Button'
import { Dialog } from './Dialog.client'
import { ZOOM_SPLIT } from './layoutSizes'

export type ZoomProps = {
  /** Names the button and the dialog */
  title: string
  /** What is enlarged, for the button's name: "Enlarge chart: <title>"; "Enlarge: <title>" without it */
  kind?: string
  /**
   * The small view, in the page. With no `large`, this same server-rendered content moves into the
   * dialog while it is open, so it is drawn once, with one set of ids.
   */
  children: React.ReactNode
  /** What the dialog shows, when it isn't the small view itself (a larger rendition of a picture) */
  large?: React.ReactNode
  /** Shown beside `large` from `lg`, under it below: a legend and the long caption. Only in the dialog */
  aside?: React.ReactNode
  /** Only a click on a match of this selector opens it; any click on the small view does when left out */
  pointerSelector?: string
  /** The wrapper of the dialog's body when there is no `aside` (a chart sets its width here) */
  bodyClassName?: string
  /** The wrapper of the small view and the button */
  className?: string
  /** Classes of the box around the small view, such as a zoom-in cursor on part of it */
  holderClassName?: string
  /** Where the Enlarge button sits; it is hidden without scripting whatever this says */
  buttonClassName?: string
}

/**
 * A small view the reader can enlarge (#815, from the chart's #681). "Enlarge", or a click or tap
 * on the small view, opens a full-screen `Dialog` (focus trap, Escape, scroll lock, focus back to
 * the button) with the large view and, beside or under it, the `aside`. The small view never shows
 * the aside: a legend's numbers can't be read small. An empty box of the same height keeps the page
 * from collapsing behind the dialog when the small view itself moves in. Without scripting the
 * button is hidden and the small view simply stays as it is.
 */
export function Zoom({
  title,
  kind,
  children,
  large,
  aside,
  pointerSelector,
  bodyClassName,
  className,
  holderClassName,
  buttonClassName,
}: ZoomProps) {
  const [open, setOpen] = useState(false)
  const holder = useRef<HTMLDivElement>(null)
  const height = useRef(0)
  const hasLarge = large !== undefined

  const change = (next: boolean) => {
    if (next) height.current = holder.current?.offsetHeight ?? 0
    setOpen(next)
  }

  // The one DOM style write: the height is known only at runtime, so no class can hold it; it is a
  // measured value on one element, and it is cleared on close
  useLayoutEffect(() => {
    if (holder.current && !hasLarge) holder.current.style.height = open ? `${height.current}px` : ''
  }, [open, hasLarge])

  // A pointer shortcut: the button is the keyboard and screen reader path
  useEffect(() => {
    const element = holder.current
    if (!element || open) return
    const onClick = (event: MouseEvent) => {
      // Selecting text ends in a click: a reader copying it is not asking to enlarge
      if (window.getSelection()?.toString()) return
      if (
        !pointerSelector ||
        (event.target instanceof Element && event.target.closest(pointerSelector))
      )
        change(true)
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [open, pointerSelector])

  const main = hasLarge ? large : children

  return (
    <div className={cn('relative flex flex-col gap-2', className)}>
      <Dialog
        open={open}
        onOpenChange={change}
        title={title}
        hideTitle
        trigger={
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Enlarge${kind ? ` ${kind}` : ''}: ${title}`}
            className={cn(
              'hidden self-end lg:min-h-11 lg:px-4 scripted:inline-flex',
              buttonClassName,
            )}
            iconStart={<Maximize2 aria-hidden="true" />}
          >
            Enlarge
          </Button>
        }
      >
        <div className="container py-8">
          {aside ? (
            <div className={ZOOM_SPLIT}>
              <div className="min-w-0">{main}</div>
              <div className="min-w-0">{aside}</div>
            </div>
          ) : (
            <div className={cn('mx-auto', bodyClassName)}>{main}</div>
          )}
        </div>
      </Dialog>
      <div
        ref={holder}
        data-zoom-holder
        aria-hidden={open && !hasLarge ? true : undefined}
        className={cn('w-full', holderClassName)}
      >
        {open && !hasLarge ? null : children}
      </div>
    </div>
  )
}
