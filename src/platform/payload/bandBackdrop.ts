import type { Field } from 'payload'

import type { Media } from '@/payload-types'
import type { BandBackdrop } from '@/platform/lib'

import { imagesOnly } from './imagesOnly'
import { toImageRef } from './imageRef'

type StoredBackdrop = {
  phone?: number | Media | null
  tablet?: number | Media | null
  desktop?: number | Media | null
}

const crop = (name: 'phone' | 'tablet' | 'desktop', label: string, shows: string): Field => ({
  name,
  type: 'upload',
  relationTo: 'media',
  filterOptions: imagesOnly,
  label,
  admin: { description: shows },
})

/**
 * The photo behind a post's or an event's title band (#1024): a group of three optional uploads,
 * one crop per screen size, so an editor chooses what the band shows at each width with no code
 * change (the upload's own focal point, set in Media, fine-tunes the part shown when the band is
 * taller or shorter than the file). Native Payload: uploads, `filterOptions`, a group. Shared by
 * posts and events, which store it the same way.
 */
export const bandBackdropField = (): Field => ({
  name: 'backdrop',
  type: 'group',
  label: 'Title band photo',
  admin: {
    description:
      'An optional photo shown faded behind the title, edge to edge. Choose the crop for each screen size: the band is a wide, short strip, so a photo whose good part cannot fill it is not used. A size left empty uses the nearest crop that is set; all three empty keeps the plain band. Fine-tune the part shown with the focal point of each upload in Media. Never use a photo with identifiable people.',
  },
  fields: [
    crop('phone', 'Phone crop', 'Under 768 px wide. A near-square crop reads best.'),
    crop('tablet', 'Tablet crop', 'From 768 px to 959 px wide.'),
    crop('desktop', 'Desktop crop', 'From 960 px wide: the widest, shortest strip.'),
  ],
})

/**
 * A document's backdrop for a module's mappers: the crops that are loaded (`depth` ≥ 1), or none
 * when the article has no photo, which is the plain band.
 */
export function toBandBackdrop(value: StoredBackdrop | null | undefined): BandBackdrop | null {
  const backdrop: BandBackdrop = {
    phone: toImageRef(value?.phone),
    tablet: toImageRef(value?.tablet),
    desktop: toImageRef(value?.desktop),
  }
  return backdrop.phone || backdrop.tablet || backdrop.desktop ? backdrop : null
}
