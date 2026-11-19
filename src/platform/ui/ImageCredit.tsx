import React from 'react'

import type { ImageRef } from '@/platform/lib/content'
import { toLicenseName } from '@/platform/lib/mediaLicenses'

import { Caption } from './Caption'
import { Link } from './Link'

/**
 * The credit a licensed photo needs where it's shown (#405): "Photo: Jane Doe, CC BY-SA 4.0".
 * The name links to where the photo came from and the license to its text, when the media item
 * has those links. Shows nothing for an image with no credit.
 */
export function ImageCredit({
  image,
  className,
}: {
  image: ImageRef | null | undefined
  className?: string
}) {
  const credit = image?.credit?.trim()
  if (!image || !credit) return null

  const licenseName = toLicenseName(image.license, image.licenseUrl)

  return (
    <Caption size="sm" className={className}>
      Photo:{' '}
      {image.sourceUrl ? (
        <Link href={image.sourceUrl} external variant="caption">
          {credit}
        </Link>
      ) : (
        credit
      )}
      {licenseName && (
        <>
          ,{' '}
          {image.licenseUrl ? (
            <Link href={image.licenseUrl} external variant="caption">
              {licenseName}
            </Link>
          ) : (
            licenseName
          )}
        </>
      )}
    </Caption>
  )
}
