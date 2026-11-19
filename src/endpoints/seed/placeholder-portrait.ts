import type { File } from 'payload'
import sharp from 'sharp'

import type { Media } from '@/payload-types'

/**
 * A neutral head-and-shoulders silhouette, drawn here, so dev shows the elected officials' card
 * with a portrait without using anyone's real photo (#393). Real portraits are uploaded in Admin
 * only with the official's permission.
 */
export const placeholderPortrait: Omit<Media, 'createdAt' | 'id' | 'updatedAt'> = {
  alt: 'Placeholder portrait',
  credit: 'Sprecher East placeholder',
}

const SILHOUETTE = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <rect width="500" height="500" fill="#d9e6df"/>
  <circle cx="250" cy="195" r="95" fill="#7fa893"/>
  <path d="M70 500c0-110 80-185 180-185s180 75 180 185z" fill="#7fa893"/>
</svg>`

export async function placeholderPortraitFile(): Promise<File> {
  const data = await sharp(Buffer.from(SILHOUETTE)).webp().toBuffer()
  return {
    name: 'placeholder-portrait.webp',
    data,
    mimetype: 'image/webp',
    size: data.byteLength,
  }
}
