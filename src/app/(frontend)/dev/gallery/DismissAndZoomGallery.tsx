import React from 'react'

import { Alert } from '@/platform/ui/Alert'
import { Dismissible } from '@/platform/ui/Dismissible.client'
import { Zoom } from '@/platform/ui/Zoom.client'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

/** What a reader can close or enlarge */
export function DismissAndZoomGallery() {
  return (
    <>
      <GalleryEntry
        name="Dismissible"
        description="A notice with a close button. It stays closed on that browser, and can stop showing at a set time."
      >
        <GalleryVariant label="closable banner" className="block w-full">
          <Dismissible id="gallery-dismissible">
            <Alert tone="info" live={false} className="pr-14">
              WisDOT holds a virtual public meeting on Tue, Nov 10 at 5:30 PM Central.
            </Alert>
          </Dismissible>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="Zoom"
        description="A small view that opens larger in a dialog. The key shows only there: beside the large view from lg, under it below."
      >
        <GalleryVariant label="with a key" className="block w-full max-w-sm">
          <Zoom
            title="Sample figure"
            large={<p className="rounded-xl bg-muted p-24 text-center">The large view</p>}
            aside={<p>The key is shown only here, never in the small view.</p>}
          >
            <p className="rounded-xl bg-muted p-8 text-center">The small view</p>
          </Zoom>
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}
