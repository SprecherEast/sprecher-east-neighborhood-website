import type { Media } from '@/payload-types'

export const imagePark: Omit<Media, 'createdAt' | 'id' | 'updatedAt'> = {
  alt: 'Neighbors and their dogs on a sunny park lawn under tall trees',
}
