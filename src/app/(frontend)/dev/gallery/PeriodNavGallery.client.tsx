'use client'

import React from 'react'

import { PeriodNav } from '@/platform/ui/PeriodNav'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'

const MONTHS = ['November 2026', 'October 2026', 'September 2026']

/** A month title that steps back and forward, stopping at the first and last of three months */
export function PeriodNavGallery() {
  const [index, setIndex] = React.useState(1)
  return (
    <GalleryEntry
      name="PeriodNav"
      description="A title with a button on each side that steps to the period before and the one after it."
    >
      <GalleryVariant label="month, both directions" className="block max-w-sm">
        <PeriodNav
          title={MONTHS[index]}
          previousLabel="Earlier month"
          nextLabel="Later month"
          onPrevious={() => setIndex(index + 1)}
          onNext={() => setIndex(index - 1)}
          previousDisabled={index === MONTHS.length - 1}
          nextDisabled={index === 0}
        />
      </GalleryVariant>
    </GalleryEntry>
  )
}
