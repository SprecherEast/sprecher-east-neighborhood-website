import React from 'react'

import { IMAGE_QUALITIES } from '@/imageQualities'
import { cn } from '@/platform/lib/cn'
import {
  resolveBandBackdrop,
  type BackdropSize,
  type BandBackdrop as Backdrop,
} from '@/platform/lib'

import { Media } from './Media'

/*
 * The screen sizes each box shows at, as classes. A box is `absolute inset-0` and hidden where it
 * isn't used, so only the crop for the screen's size is ever loaded (an image that is not shown
 * isn't fetched while it is lazy). The edges are the theme's `md` (tablet) and `lg` (desktop)
 * breakpoints. Written out whole so Tailwind sees each class.
 */
const SHOWN_AT: Record<string, string> = {
  phone: 'md:hidden',
  tablet: 'max-md:hidden lg:hidden',
  desktop: 'max-lg:hidden',
  'phone tablet': 'lg:hidden',
  'tablet desktop': 'max-md:hidden',
  'phone desktop': 'md:max-lg:hidden',
  'phone tablet desktop': '',
}

const showKey = (sizes: BackdropSize[]) => sizes.join(' ')

/*
 * A neighborhood photo behind a post's or an event's title band (#1024): edge to edge, faded and
 * slightly grayed, then washed with a `--surface` scrim, so the title and the category keep the
 * contrast the theme was checked for over the lightest and the darkest a photo can be, in light
 * and dark (`BAND_PHOTO_ALPHA` and `BAND_SCRIM_ALPHA` in the theme contract, tested in
 * `themes.test.ts`; the classes below carry the same numbers, tested here). It has one crop per
 * screen size, each the part of a photo an editor chose for that size, kept in view by the upload's
 * focal point (`Media atFocalPoint`). A decoration: hidden from assistive tech, with an empty alt.
 * It is the band's own background, so it draws nothing when no crop is set. Fill the nearest
 * positioned ancestor (the band).
 */
export function BandBackdrop({ backdrop }: { backdrop: Backdrop | null | undefined }) {
  const slots = resolveBandBackdrop(backdrop)
  if (slots.length === 0) return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {slots.map(({ image, sizes }) => (
        <div
          key={image.id}
          data-backdrop-size={showKey(sizes)}
          className={cn('absolute inset-0', SHOWN_AT[showKey(sizes)])}
        >
          {/* `Media` prefers the upload's own alt text, so clear it on the copy it draws */}
          <Media
            resource={{ ...image, alt: '' }}
            fill
            atFocalPoint
            quality={IMAGE_QUALITIES.backdrop}
            size="100vw"
            htmlElement={null}
            imgClassName="object-cover opacity-60 grayscale-50"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-surface/50" />
    </div>
  )
}
