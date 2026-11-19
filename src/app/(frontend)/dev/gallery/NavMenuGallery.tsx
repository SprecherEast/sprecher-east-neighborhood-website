import React from 'react'

import { NavMenu } from '@/platform/ui/NavMenu.client'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const ITEMS = [
  { href: '#gallery-navmenu-1', label: 'Sample: first page' },
  { href: '#gallery-navmenu-2', label: 'Sample: second page' },
  { href: '#gallery-navmenu-3', label: 'Sample: a page with a longer name' },
]

/** A button that opens a menu of links by a press: a panel on a wide screen, an accordion on a phone */
export function NavMenuGallery() {
  return (
    <GalleryEntry
      name="NavMenu"
      description="A header item that opens a menu of links when pressed, never on hover; closes on Escape, a press elsewhere or a link."
    >
      <GalleryVariant label="dropdown" className="block min-h-48">
        <NavMenu label="Sample menu" items={ITEMS} layout="dropdown" />
      </GalleryVariant>
      <GalleryVariant label="stacked" className="block max-w-xs">
        <NavMenu label="Sample menu" items={ITEMS} layout="stacked" />
      </GalleryVariant>
    </GalleryEntry>
  )
}
