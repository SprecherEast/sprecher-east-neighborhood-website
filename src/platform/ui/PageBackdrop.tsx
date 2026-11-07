import React from 'react'

import type { ImageRef } from '@/platform/lib'

import { Media } from './Media'

/*
 * A faint photo behind a page's content (#777, epic #619): the photo is grayed and faded, then
 * washed into the theme's own background colour, fully at its top and bottom edges, so it is felt rather than seen
 * and the text over it keeps the contrast the theme was checked for, in light and dark. It covers
 * the top 28 rem of the page only and fades out at both ends, so it leaves no edge and a long page
 * doesn't stretch a small photo. Over the photo, text is stronger in both themes (the owner's ask):
 * muted gray becomes a mix of the main text colour and the background, and primary-coloured text (links, eyebrows) takes
 * `primary-strong`, the shade made for panels; both only inside this component. It is a decoration:
 * hidden from assistive tech, with an empty alt, never between a title and its content. Without a
 * photo it draws only its children.
 */
export type PageBackdropProps = {
  image?: ImageRef | null
  children: React.ReactNode
}

export function PageBackdrop({ image, children }: PageBackdropProps) {
  if (!image) return <>{children}</>

  return (
    <div className="relative isolate [--muted-foreground:color-mix(in_srgb,var(--foreground)_80%,var(--background))] [--primary:var(--primary-strong)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] max-h-full overflow-hidden"
      >
        {/* `Media` prefers the upload's own alt text, so clear it on the copy it draws */}
        <Media
          resource={{ ...image, alt: '' }}
          fill
          quality={50}
          size="100vw"
          htmlElement={null}
          imgClassName="object-cover object-[center_45%] opacity-35 grayscale dark:opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background" />
      </div>
      {children}
    </div>
  )
}
