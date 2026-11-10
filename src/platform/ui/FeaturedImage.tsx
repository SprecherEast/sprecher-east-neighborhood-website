import React from 'react'

import { cn } from '@/platform/lib/cn'
import type { ImageRef } from '@/platform/lib/content'

import { ImageCredit } from './ImageCredit'
import { READING_COLUMN } from './layoutSizes'
import { Media } from './Media'

// The article column is never wider than the reading width, so the browser needs no larger file
const SIZES = '(min-width: 960px) 48rem, 100vw'

/**
 * The picture of a post or an event, at the top of the article's column (#1013): shown whole, at
 * its own proportions, never cropped, so a picture that carries text (a panel of facts) stays
 * readable at every width. It is the first image the visitor sees, so it loads early, and it takes
 * the reading width from the column's left edge so its edges line up with the text. Its credit
 * shows under it. With no picture it draws nothing, so no gap is left.
 */
export function FeaturedImage({
  image,
  className,
}: {
  image: ImageRef | null | undefined
  className?: string
}) {
  if (!image) return null

  return (
    <figure className={cn('mb-8', READING_COLUMN, className)}>
      <Media priority size={SIZES} imgClassName="h-auto w-full rounded-xl" resource={image} />
      <ImageCredit image={image} className="mt-2 text-right" />
    </figure>
  )
}
