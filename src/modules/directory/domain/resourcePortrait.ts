import type { ImageRef } from '@/platform/lib'

import { isResourceUrl } from './resourceUrl'
import type { ResourceSummary } from './types'

/** The one category whose cards may show a photo: an official's portrait, with permission (#393). */
export const PORTRAIT_CATEGORY = 'elected-officials' satisfies ResourceSummary['category']

/** An optional link field on a resource: empty, or a web address `isResourceUrl` accepts. */
export function checkResourceUrl(value: string | null | undefined): true | string {
  return !value || isResourceUrl(value) || 'Must be a valid URL starting with http:// or https://'
}

/**
 * A resource's photo credit: required once a photo is set, so every photo says whose it is. The
 * card writes "Photo:" in front, so the credit leaves it out.
 */
export function checkPhotoCredit(credit: string | null | undefined, photo: unknown): true | string {
  const text = credit?.trim() ?? ''
  if (photo === null || photo === undefined || photo === '') return true
  if (!text) return 'A photo needs a credit, for example "City of Madison".'
  if (/^photo:/i.test(text)) return 'Leave out "Photo:": the card adds it.'
  return true
}

/**
 * The portrait a resource card shows: an elected official's loaded photo with a credit, or none.
 * The image is named after the official, and carries the resource's own credit and source (not
 * the media item's), so `Media` and `ImageCredit` show it as they show any other photo.
 */
export function resourcePortrait(resource: ResourceSummary): ImageRef | null {
  const { photo, photoCredit, photoSourceUrl, category, title } = resource
  const credit = photoCredit?.trim()
  if (category !== PORTRAIT_CATEGORY || !photo || typeof photo !== 'object' || !credit) return null

  return {
    ...photo,
    alt: title,
    credit,
    sourceUrl: photoSourceUrl && isResourceUrl(photoSourceUrl) ? photoSourceUrl : null,
    license: null,
    licenseUrl: null,
  }
}
