import type { Media } from '@/payload-types'

export const image3: Omit<Media, 'createdAt' | 'id' | 'updatedAt'> = {
  alt: 'Map of Sprecher East in green, between I-94, Sprecher Road and Cottage Grove Road, with North Star and Richmond Hill Homeowners shaded gray',
}
