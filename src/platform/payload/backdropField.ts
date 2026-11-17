import type { Field } from 'payload'

import type { Media } from '@/payload-types'
import type { BackdropCrops } from '@/platform/lib'

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
 * The photo behind a whole post or event (#1024, #1268): a group of three optional uploads, one
 * crop per screen size, so an editor chooses what the page shows at each width with no code change
 * (the upload's own focal point, set in Media, fine-tunes the part shown). Native Payload: uploads,
 * `filterOptions`, a group. Shared by posts and events, which store it the same way; the stored
 * shape is unchanged, so existing content needs no migration.
 */
export const backdropField = (): Field => ({
  name: 'backdrop',
  type: 'group',
  label: 'Page backdrop photo',
  admin: {
    description:
      'An optional photo shown in full color behind the whole page, edge to edge, with the page color over it where there is text. Choose the crop for each screen size: the photo fills the screen, so pick the part worth seeing for each. A size left empty uses the nearest crop that is set; all three empty keeps a plain page. Fine-tune the part shown with the focal point of each upload in Media. Never use a photo with identifiable people.',
  },
  fields: [
    crop('phone', 'Phone crop', 'Under 768 px wide. A tall, narrow crop reads best.'),
    crop('tablet', 'Tablet crop', 'From 768 px to 959 px wide.'),
    crop('desktop', 'Desktop crop', 'From 960 px wide: the widest crop.'),
  ],
})

/**
 * A document's backdrop for a module's mappers: the crops that are loaded (`depth` ≥ 1), or none
 * when the article has no photo, which is a plain page.
 */
export function toBackdropCrops(value: StoredBackdrop | null | undefined): BackdropCrops | null {
  const backdrop: BackdropCrops = {
    phone: toImageRef(value?.phone),
    tablet: toImageRef(value?.tablet),
    desktop: toImageRef(value?.desktop),
  }
  return backdrop.phone || backdrop.tablet || backdrop.desktop ? backdrop : null
}
