'use client'

import { Maximize2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { cn } from '@/platform/lib/cn'
import { toGoogleMapsEmbedUrl } from '@/platform/lib/googleMapsEmbed'

import { Button } from './Button'
import { Dialog } from './Dialog.client'

export type MapEmbedProps = {
  /** A Google map embed address (`toGoogleMapsEmbedUrl`); anything else draws no live map */
  embedUrl?: string | null
  /** Names the dialog and the frame for screen readers */
  title: string
  /** What the buttons say: "View the larger map" */
  actionLabel: string
  /** The small picture of the map, drawn by the caller (`Media`) */
  preview: React.ReactNode
  /** The text beside the picture, on its left from `md` up; the button that opens the live map follows it */
  children?: React.ReactNode
  className?: string
}

/**
 * A small map picture with its text, and a live Google map in a dialog when a neighbor taps
 * either button (#764, docs/ui/component-set.md). The frame is created only once the dialog is
 * open, so the page asks Google for nothing until then. A missing or unsafe address leaves the
 * picture and the text, with no button.
 */
export function MapEmbed({
  embedUrl,
  title,
  actionLabel,
  preview,
  children,
  className,
}: MapEmbedProps) {
  const [open, setOpen] = useState(false)
  const src = toGoogleMapsEmbedUrl(embedUrl)
  // Two buttons open the dialog, so focus goes back to the one that did, not to a single trigger
  const opener = useRef<HTMLElement | null>(null)
  const openFrom = (event: React.MouseEvent<HTMLElement>) => {
    opener.current = event.currentTarget
    setOpen(true)
  }
  useEffect(() => {
    if (!open) opener.current?.focus()
  }, [open])

  return (
    <div
      className={cn(
        'grid items-start gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] md:gap-8',
        className,
      )}
    >
      <div className="w-56 max-w-full md:order-2 md:w-full">
        {src ? (
          <Button
            variant="ghost"
            aria-label={actionLabel}
            onClick={openFrom}
            className="block h-auto min-h-0 w-full overflow-hidden rounded-xl border border-border p-0 hover:opacity-90"
          >
            {preview}
          </Button>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">{preview}</div>
        )}
      </div>
      <div className="space-y-4 text-left md:order-1">
        {children}
        {src && (
          <Button
            variant="secondary"
            iconStart={<Maximize2 aria-hidden="true" />}
            onClick={openFrom}
          >
            {actionLabel}
          </Button>
        )}
      </div>
      {src && (
        <Dialog open={open} onOpenChange={setOpen} title={title}>
          <div className="container py-4">
            <iframe
              src={src}
              title={title}
              className="h-[80svh] min-h-96 w-full rounded-xl border border-border"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              allowFullScreen
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}
