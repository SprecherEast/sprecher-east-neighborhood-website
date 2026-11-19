import React from 'react'

import type { ImageRef } from '@/platform/lib/content'

import { Figure } from './Figure'
import { ImageCredit } from './ImageCredit'

/**
 * The picture of a post or an event, at the start of the article's text (#1013, #1023): shown whole,
 * at its own proportions, never cropped, so a picture that carries text (a panel of facts) stays
 * readable. On a phone it fills the column above the text; from a tablet it floats right, half the
 * column wide, then a third from the desktop breakpoint, with the text wrapping beside it. It is the
 * shared `Figure` (the article figure's float and wrap) without its zoom, so there is no Enlarge
 * button and the picture starts on the text's first line, loading early because it is the first
 * image seen. Its credit shows under it. With no picture it draws nothing, so no gap is left.
 */
export function FeaturedImage({
  image,
  className,
}: {
  image: ImageRef | null | undefined
  className?: string
}) {
  if (!image) return null
  const credit = image.credit?.trim() ? <ImageCredit image={image} className="text-left" /> : null

  return (
    <Figure
      resource={image}
      title={image.alt?.trim() || 'Picture for this article'}
      size="half-then-third"
      zoom={false}
      priority
      caption={credit}
      // The bar above already leaves its space, and the text's first line is the picture's top
      className={className ? `mt-0 md:mt-0 ${className}` : 'mt-0 md:mt-0'}
    />
  )
}
