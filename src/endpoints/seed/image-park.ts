import type { Media } from '@/payload-types'

export const imagePark: Omit<Media, 'createdAt' | 'id' | 'updatedAt'> = {
  alt: 'People and dogs on a sunny park lawn under tall trees',
}
