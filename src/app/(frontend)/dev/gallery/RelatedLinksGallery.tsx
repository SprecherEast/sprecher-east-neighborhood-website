import React from 'react'

import { RelatedLinks } from '@/platform/ui/RelatedLinks'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const ITEMS = [
  { href: '#gallery-relatedlinks-1', label: 'Sample: first page' },
  { href: '#gallery-relatedlinks-2', label: 'Sample: second page' },
  { href: '#gallery-relatedlinks-3', label: 'Sample: a page with a longer name' },
]

/** A titled list of links to related pages, for a page's rail or the bottom of its content */
export function RelatedLinksGallery() {
  return (
    <GalleryEntry
      name="RelatedLinks"
      description="A titled list of links to related pages: under the content on a phone, in the rail from lg."
    >
      <GalleryVariant label="three links" className="block max-w-xs">
        <RelatedLinks title="More pages" items={ITEMS} />
      </GalleryVariant>
    </GalleryEntry>
  )
}
