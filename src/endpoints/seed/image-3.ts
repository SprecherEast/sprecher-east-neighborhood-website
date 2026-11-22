import type { Media } from '@/payload-types'

export const image3: Omit<Media, 'createdAt' | 'id' | 'updatedAt'> = {
  alt: 'Map of Sprecher East outlined in green: I-94 along the north, Sprecher Road along the west and Cottage Grove Road along the south, with Door Creek Park on the east side, North Star next door to the west and Richmond Hill Homeowners to the southwest',
}
