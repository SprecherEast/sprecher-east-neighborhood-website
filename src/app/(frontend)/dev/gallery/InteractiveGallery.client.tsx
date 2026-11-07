'use client'

import { RefreshCw } from 'lucide-react'
import React, { useState } from 'react'

import { Button } from '@/platform/ui/Button'
import { Dialog } from '@/platform/ui/Dialog.client'
import { LoadMoreFooter } from '@/platform/ui/LoadMore.client'
import { MapEmbed } from '@/platform/ui/MapEmbed.client'
import { Toast } from '@/platform/ui/Toast'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

/** Components that need state to show: the dialog, the toast and "Load more" */
export function InteractiveGallery() {
  return (
    <>
      <GalleryEntry name="Dialog" description="A full-screen sheet; Radix gives the behaviour.">
        <GalleryVariant label="sheet">
          <SampleDialog />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="MapEmbed"
        description="A small map picture with its text; a live Google map opens in a dialog on tap."
      >
        <GalleryVariant label="with a map address, and without" className="block space-y-8">
          <MapEmbed
            embedUrl="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3000!2d-89.3!3d43.1"
            title="Sample map"
            actionLabel="View the larger map"
            preview={<div className="aspect-square bg-surface" />}
          >
            <p>The frame loads only after the button is tapped.</p>
          </MapEmbed>
          <MapEmbed
            title="Sample map"
            actionLabel="View the larger map"
            preview={<div className="aspect-square bg-surface" />}
          >
            <p>Without an address there is the picture and the text, and no button.</p>
          </MapEmbed>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="Toast"
        description="Fixed to the bottom of the screen on the site; held in a frame here."
      >
        <GalleryVariant label="tone info, with an action" className="block">
          <SampleToast />
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry name="LoadMore" description="The footer of a feed: status text and the button.">
        <GalleryVariant label="more to load, and loading" className="block">
          <SampleLoadMore />
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}

function SampleDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Sample dialog"
      trigger={<Button variant="secondary">Open the dialog</Button>}
    >
      <div className="container py-8">
        <p className="max-w-prose">
          Focus is trapped in here. Escape or the close button closes it, and focus goes back to the
          button that opened it.
        </p>
        <Button className="mt-6" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
    </Dialog>
  )
}

function SampleToast() {
  const [visible, setVisible] = useState(true)
  return (
    <>
      {/* Paint containment makes the frame the fixed toast's containing block */}
      <div className="relative h-32 overflow-hidden rounded-2xl border border-border bg-surface contain-paint">
        <Toast
          message="A new version of the site is available."
          icon={<RefreshCw />}
          action={
            <Button size="sm" variant="secondary">
              Refresh
            </Button>
          }
          visible={visible}
          onDismiss={() => setVisible(false)}
        />
      </div>
      {!visible && (
        <Button className="mt-4" variant="ghost" onClick={() => setVisible(true)}>
          Show the toast again
        </Button>
      )}
    </>
  )
}

function SampleLoadMore() {
  const [status, setStatus] = useState<'idle' | 'loading'>('idle')
  return (
    <LoadMoreFooter
      noun="posts"
      shownCount={12}
      firstItemNumber={1}
      totalDocs={30}
      hasMore
      status={status}
      // No scrolling loads in the gallery: the button is the only trigger
      autoLoad={false}
      onLoadMore={() => setStatus((now) => (now === 'idle' ? 'loading' : 'idle'))}
      fallbackHref="/posts/page/2"
      className="mt-0"
    />
  )
}
