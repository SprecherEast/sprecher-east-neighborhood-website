import type { FilterOptions } from 'payload'

/**
 * For an upload field that must hold a picture: the media library also holds PDFs and videos,
 * which a card or a backdrop can't draw as one (a video would loop as motion). Payload applies
 * this both when choosing a file and when saving.
 */
export const imagesOnly: FilterOptions = { mimeType: { contains: 'image/' } }
