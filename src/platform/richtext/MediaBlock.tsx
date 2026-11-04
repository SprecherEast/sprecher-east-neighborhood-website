import type { StaticImageData } from 'next/image'

import { cn } from '@/platform/lib/cn'
import React from 'react'
import { RichText } from './RichText'

import type { MediaBlock as MediaBlockProps } from '@/payload-types'

import { FIGURE_GAP } from '@/platform/ui/layoutSizes'
import { Media } from '@/platform/ui/Media'

type Props = MediaBlockProps & {
  /**
   * Where the block sits, which decides who owns the space around it (#541):
   * - `section` (default): a page-builder block. It is its own section, so it brings the
   *   container and the section padding.
   * - `inline`: inside rich text. The article flow already spaces its children, so the block opts
   *   out of the `prose` typography styles (their `picture` margins) and sets one margin, the
   *   shared `FIGURE_GAP`, which a legend under the image reaches back over (#636). It also sits
   *   above the legend, whose square top tucks under the image.
   */
  placement?: 'section' | 'inline'
  captionClassName?: string
  className?: string
  imgClassName?: string
  staticImage?: StaticImageData
}

export const MediaBlock: React.FC<Props> = (props) => {
  const {
    captionClassName,
    className,
    imgClassName,
    media,
    placement = 'section',
    staticImage,
  } = props
  const inline = placement === 'inline'

  let caption
  if (media && typeof media === 'object') caption = media.caption

  return (
    <div
      className={cn(inline ? `relative z-10 ${FIGURE_GAP}` : 'container py-10 md:py-14', className)}
    >
      {(media || staticImage) && (
        <Media
          // Only the image opts out of `prose`: the caption below is rich text and keeps it
          className={cn(inline && 'not-prose')}
          imgClassName={cn('border border-border rounded-[0.8rem]', imgClassName)}
          resource={media}
          src={staticImage}
        />
      )}
      {caption && (
        // No container of its own in either placement: the block's own container (section) or the
        // article column (inline) already sets the width, and a nested one would indent the caption
        <div className={cn('mt-6', captionClassName)}>
          <RichText data={caption} enableGutter={false} />
        </div>
      )}
    </div>
  )
}
