import React from 'react'

import { cn } from '@/platform/lib/cn'
import { GlassPanel } from '@/platform/ui/GlassPanel'
import { Media } from '@/platform/ui/Media'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'
import { SAMPLE_IMAGE } from './sampleData'

/** What the panel sits on: the lightest and darkest a page or photo gets, so its text is checked at both ends */
const BACKDROPS = [
  { label: 'light photo', photo: true, wash: 'bg-on-image/70' },
  { label: 'dark photo', photo: true, wash: 'bg-scrim/60' },
  { label: 'plain light', photo: false, wash: 'bg-on-image' },
  { label: 'plain dark', photo: false, wash: 'bg-scrim' },
] as const

/** The shared glass panel over a light photo, a dark photo, plain light and plain dark */
export function GlassGallery() {
  return (
    <GalleryEntry
      name="GlassPanel"
      description="One frosted-glass look, in light and dark. It darkens itself, so its text reads on any backdrop."
    >
      <GalleryVariant label="backdrop" className="grid w-full gap-6 sm:grid-cols-2">
        {BACKDROPS.map(({ label, photo, wash }) => (
          <div key={label} className="relative isolate overflow-hidden rounded-xl p-6">
            {photo && (
              <div aria-hidden="true" className="absolute inset-0 -z-20">
                <Media fill imgClassName="object-cover" resource={SAMPLE_IMAGE} />
              </div>
            )}
            <div aria-hidden="true" className={cn('absolute inset-0 -z-10', wash)} />
            <GlassPanel>
              <p className="text-base leading-relaxed">
                A line of text on the glass, over a {label}.
              </p>
            </GlassPanel>
          </div>
        ))}
      </GalleryVariant>
    </GalleryEntry>
  )
}
