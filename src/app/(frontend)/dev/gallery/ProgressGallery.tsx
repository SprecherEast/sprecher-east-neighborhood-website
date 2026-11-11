import React from 'react'

import { ProgressBar } from '@/platform/ui/ProgressBar'
import { ShareBar, type ShareBarSlice } from '@/platform/ui/ShareBar'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const SLICES: ShareBarSlice[] = [
  { key: 'a', share: 46.5, tone: 'strong', label: '46%' },
  { key: 'b', share: 37.5, tone: 'highlight', label: '38%' },
  { key: 'c', share: 12.5, tone: 'medium', label: '13%' },
  { key: 'd', share: 3.5, tone: 'light' },
]

/** The progress bar: both sizes, empty and full; and the share bar */
export function ProgressGallery() {
  return (
    <GalleryEntry
      name="ProgressBar"
      description="How far along something is; always written out beside it."
    >
      {(['md', 'sm'] as const).map((size) => (
        <GalleryVariant key={size} label={`size ${size}`} className="block max-w-md">
          <ProgressBar value={3} max={8} size={size} label="Sample: 3 of 8 done" />
        </GalleryVariant>
      ))}
      <GalleryVariant label="empty, and full" className="block max-w-md space-y-3">
        <ProgressBar value={0} max={0} label="Sample: nothing to count yet" />
        <ProgressBar value={8} max={8} label="Sample: 8 of 8 done" />
      </GalleryVariant>
    </GalleryEntry>
  )
}

/** The share bar: one whole in slices, one highlighted and joined to the panel under it */
export function ShareBarGallery() {
  return (
    <GalleryEntry
      name="ShareBar"
      description="One whole as a bar of slices as wide as their shares; the highlighted slice joins the panel under it."
    >
      <GalleryVariant label="with a highlighted slice and a panel" className="block max-w-3xl">
        <ShareBar slices={SLICES} label="Sample: a whole split in four">
          <p>Sample panel under the highlighted slice.</p>
        </ShareBar>
      </GalleryVariant>
      <GalleryVariant label="no highlight, no panel" className="block max-w-3xl">
        <ShareBar
          slices={SLICES.map((slice) => ({ ...slice, tone: 'light' as const }))}
          label="Sample: a whole split in four, none highlighted"
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}
