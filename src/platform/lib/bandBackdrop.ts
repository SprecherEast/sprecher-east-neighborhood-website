import type { ImageRef } from './content'

/** The three screen sizes a title band's photo is cropped for: phone, tablet and desktop */
export const BACKDROP_SIZES = ['phone', 'tablet', 'desktop'] as const
export type BackdropSize = (typeof BACKDROP_SIZES)[number]

/**
 * The photo behind a post's or an event's title band (#1024), one crop per screen size. Each crop
 * is an upload of its own, so an editor chooses what the band shows at each width and fine-tunes it
 * with the upload's focal point. No crop at all is the plain band.
 */
export type BandBackdrop = Record<BackdropSize, ImageRef | null>

/** What draws one photo, and the screen sizes it is shown at */
export type BackdropSlot = { image: ImageRef; sizes: BackdropSize[] }

// A size with no crop of its own takes the nearest one set: the tablet the wider crop first, the
// phone and the desktop the one next to them
const PREFERENCE: Record<BackdropSize, readonly BackdropSize[]> = {
  phone: ['phone', 'tablet', 'desktop'],
  tablet: ['tablet', 'desktop', 'phone'],
  desktop: ['desktop', 'tablet', 'phone'],
}

/**
 * The photos to draw behind the band and where each shows. A photo several sizes use is listed
 * once, so the page holds no more images than it has different crops. Empty when no crop is set.
 */
export function resolveBandBackdrop(backdrop: BandBackdrop | null | undefined): BackdropSlot[] {
  if (!backdrop) return []

  const slots: BackdropSlot[] = []
  for (const size of BACKDROP_SIZES) {
    const image = PREFERENCE[size].map((from) => backdrop[from]).find((value) => value !== null)
    if (!image) continue
    const slot = slots.find((existing) => existing.image.id === image.id)
    if (slot) slot.sizes.push(size)
    else slots.push({ image, sizes: [size] })
  }
  return slots
}
