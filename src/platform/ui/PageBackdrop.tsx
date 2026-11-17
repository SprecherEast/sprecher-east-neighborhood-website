import React from 'react'

import { IMAGE_QUALITIES } from '@/imageQualities'
import { cn } from '@/platform/lib/cn'
import { resolveBackdrop, type BackdropCrops, type BackdropSize } from '@/platform/lib'

import { BackdropParallax } from './BackdropParallax.client'
import { Media } from './Media'

/*
 * The screen sizes each crop shows at, as classes. A crop is `absolute inset-0` and hidden where it
 * isn't used, so only the one for the screen's size is ever loaded (a lazy image that is not shown
 * isn't fetched). The edges are the theme's `md` (tablet) and `lg` (desktop) breakpoints. Written
 * out whole so Tailwind sees each class.
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
 * A neighborhood photo behind a whole page, post or event (#777, #1024, #1268; images guideline,
 * rule 14): the photo runs from the top of the page to its foot in full colour, fixed to the screen
 * and drifting slowly as the page scrolls (`BackdropParallax`, still for reduced motion), under a
 * faint scrim of the theme's own background (`BACKDROP_SCRIM_ALPHA`, the same for every photo). The
 * scrim is faint because it is not what keeps text readable: text sits on its own solid page-colour
 * block inside the page (`text-plate`, `text-fade`) and the title on a wide soft glow
 * (`text-shadow-glow`), all of them drawn only inside this component through `data-backdrop` (the
 * `on-photo:` variant). So the photo shows plainly where there is no text: behind the title, beside
 * the rail, before the footer.
 *
 * The page's own box is not a stacking context (no `relative`, no `isolate`): the photo's `-z-10`
 * then puts it under everything in the page, the site footer included, which is not inside this
 * component and would otherwise be painted under it.
 *
 * It has one crop per screen size, each the part of a photo an editor chose for that size, kept in
 * view by the upload's focal point. A decoration: hidden from assistive tech, with an empty alt.
 * Over the photo, text is stronger in both themes: muted gray becomes a mix of the main text colour
 * and the background, and primary-coloured text (links, eyebrows) takes `primary-strong`, for all
 * of the page's content, so the page's accents stay one set. A photo every size shares loads at
 * once (`priority`), as it is likely the page's largest picture; with several crops none is eager,
 * or all of them would be fetched. A page with no crop draws only its children, unchanged.
 */
export type PageBackdropProps = {
  /** The crops of the photo, or none for a plain page */
  backdrop?: BackdropCrops | null
  children: React.ReactNode
}

export function PageBackdrop({ backdrop, children }: PageBackdropProps) {
  const slots = resolveBackdrop(backdrop)
  if (slots.length === 0) return <>{children}</>

  return (
    <div
      data-backdrop
      className="pb-12 [--muted-foreground:color-mix(in_srgb,var(--foreground)_80%,var(--background))] [--primary:var(--primary-strong)]"
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <BackdropParallax>
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
                priority={slots.length === 1}
                size="100vw"
                htmlElement={null}
                imgClassName="object-cover"
              />
            </div>
          ))}
        </BackdropParallax>
        <div className="absolute inset-0 bg-background/8 dark:bg-background/14" />
      </div>
      {children}
    </div>
  )
}
