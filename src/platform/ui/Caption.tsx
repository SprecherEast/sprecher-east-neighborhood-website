import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { SMALL_TEXT } from './Text'

/*
 * The one caption (#635): small, muted text right under a picture, diagram or chart that says
 * what it shows and where it came from. Every figure's caption looks the same, so none is styled
 * by hand.
 */
const captionVariants = cva('', {
  variants: {
    // `md` is a caption on its own line; `sm` is a credit line that sits under or beside an image
    size: { md: SMALL_TEXT, sm: 'text-xs text-muted-foreground' },
  },
  defaultVariants: { size: 'md' },
})

/**
 * Typography classes for a caption that is rich text: `RichText` draws it with `prose`, which sets
 * its own text colour from a variable, so the caption's size and colour are set on that element.
 */
export const CAPTION_RICH_TEXT =
  'prose-sm prose-p:leading-relaxed [--tw-prose-body:var(--color-muted-foreground)]'

type CaptionElement = 'figcaption' | 'p' | 'div'

export type CaptionProps = VariantProps<typeof captionVariants> & {
  /** `figcaption` inside a `figure`; `div` when the children are block content such as rich text */
  as?: CaptionElement
  /** A second line, smaller still, for conditions and disclaimers ("Not to scale") */
  finePrint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Small print under a figure. The fine print is a native `small` element after the caption: it
 * is the element HTML has for small print, and it needs nothing else from the page.
 */
export function Caption({ as: Element = 'p', size, finePrint, className, children }: CaptionProps) {
  return (
    <Element className={cn(captionVariants({ size }), className)}>
      {children}
      {finePrint && <small className="mt-1 block text-xs">{finePrint}</small>}
    </Element>
  )
}
