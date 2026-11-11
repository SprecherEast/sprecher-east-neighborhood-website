import React from 'react'

import { MetaBar } from '@/platform/ui/MetaBar'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'
import { SAMPLE_FACTS } from './sampleData'

const LONG_NAMES = 'Bartholomew Featherstonehaugh-Kowalczyk and Dorothea Wainwright-Papadopoulos'
const LONG_PLACE =
  'The community room at the far end of the long lakeside building on Sprecher Road, next to the library'

/** The metadata bar: aligned to the start (an event's) and to the end (a post's) */
export function MetaBarGallery() {
  return (
    <GalleryEntry
      name="MetaBar"
      description="A post's or event's metadata on one thin line above one straight groove line: grouped at the left by default (an event's), at the right in the small type when aligned to the end (a post's)."
    >
      <GalleryVariant label="aligned to the start (an event's): two items" className="block">
        <div className="w-full max-w-[var(--reading-width)]">
          <MetaBar items={SAMPLE_FACTS} />
        </div>
      </GalleryVariant>
      <GalleryVariant
        label="aligned to the start: a long place is cut to one line"
        className="block"
      >
        <div className="w-full max-w-[var(--reading-width)]">
          <MetaBar
            items={[
              { label: 'When', value: 'Sat, Nov 7, 2026 · 6:00 PM – 8:00 PM Central Time' },
              { label: 'Where', value: LONG_PLACE, title: LONG_PLACE, suffix: ' · In Person' },
            ]}
          />
        </div>
      </GalleryVariant>
      <GalleryVariant
        label="aligned to the end (a post's): a short name, then a long one cut"
        className="block"
      >
        <div className="w-full max-w-[var(--reading-width)]">
          {['Ana and Ben', LONG_NAMES].map((name) => (
            <MetaBar
              key={name}
              align="end"
              items={[
                { label: 'Author', value: name, title: name },
                { label: 'Published', value: 'Nov 3' },
              ]}
            />
          ))}
        </div>
      </GalleryVariant>
    </GalleryEntry>
  )
}
