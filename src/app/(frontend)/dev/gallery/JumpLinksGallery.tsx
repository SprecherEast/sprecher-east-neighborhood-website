import React from 'react'

import { JumpLinks } from '@/platform/ui/JumpLinks'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

// Each points back at the entry's own heading, so a press stays on the page
const ITEMS = [
  'Sample: first group',
  'Sample: second group',
  'Sample: a group with a longer name',
  'Sample: fourth',
].map((label) => ({ id: 'gallery-jumplinks', label }))

/** Links that jump to sections of the same page, wrapping onto more lines when they run out of room */
export function JumpLinksGallery() {
  return (
    <GalleryEntry
      name="JumpLinks"
      description="A row of links to sections further down the same page; they wrap instead of scrolling."
    >
      <GalleryVariant label="four links" className="block max-w-md">
        <JumpLinks label="Sample groups" items={ITEMS} />
      </GalleryVariant>
    </GalleryEntry>
  )
}
