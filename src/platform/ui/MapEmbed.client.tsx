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
  /** The text under the picture; the button that opens the live map follows it */
  children?: React.ReactNode
  className?: string
}

/*
 * The layout reads the width this component is given, not the screen's (a container query), so the
 * same block is right in a narrow column and across a full row with no setting for an editor to
 * choose. Narrow: the picture, then the text. From 48rem: the text left (5 of 8 columns, 62.5%) and
 * the picture right (3 of 8, 37.5%), the text-and-picture ratio of the design guideline (#1419).
 */
const LAYOUT = 'grid gap-6 @3xl:grid-cols-8 @3xl:items-center @3xl:gap-x-12'
const PICTURE = '@3xl:order-2 @3xl:col-span-3'
const TEXT = 'space-y-4 @3xl:order-1 @3xl:col-span-5'

/**
 * A map picture with its text under it, and a live Google map in a dialog when a neighbor taps
 * either button (#764, docs/ui/component-set.md). It fills the width it is given: the section it
 * sits in decides how wide and where it goes (#884), and the picture sits beside the text when that
 * width allows (#1419). The frame is created only once the dialog is
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
    <div className={cn('@container', className)}>
      <div className={LAYOUT}>
        <div className={PICTURE}>
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
        <div className={TEXT}>
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
