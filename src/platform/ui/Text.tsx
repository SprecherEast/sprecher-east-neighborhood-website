import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * The site's text styles in one place (#441): headings inside a page and the paragraph sizes around
 * them. A page's `h1` comes from `PageHeader` or a hero. `section` heads a part of the page,
 * `subsection` a group inside it; `overline` is the coloured eyebrow above a heading, `label` the
 * quiet uppercase name of a sidebar list or a footer column; `lead` and `small` are body text,
 * large and small.
 */
/** Small body text: also the look of a figure's caption (`Caption`), so the two can't drift apart */
export const SMALL_TEXT = 'text-sm leading-relaxed text-muted-foreground'

const textVariants = cva('', {
  variants: {
    variant: {
      section: 'text-2xl font-bold text-balance text-foreground',
      subsection: 'text-lg font-semibold text-balance text-foreground',
      overline: 'text-xs font-bold tracking-widest text-primary uppercase',
      label: 'text-xs font-bold tracking-widest text-muted-foreground uppercase',
      lead: 'text-lg text-muted-foreground',
      small: SMALL_TEXT,
    },
    clamp: { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3' },
  },
})

type Variant = NonNullable<VariantProps<typeof textVariants>['variant']>

const HEADINGS: ReadonlySet<Variant> = new Set(['section', 'subsection'])

export type TextProps = VariantProps<typeof textVariants> & {
  variant: Variant
  /** The element: headings default to `h2`, everything else to `p` (`div` when it holds a block, such as a `Badge`) */
  as?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div'
  id?: string
  className?: string
  children: React.ReactNode
}

export function Text({ variant, as, clamp, id, className, children }: TextProps) {
  const Element = as ?? (HEADINGS.has(variant) ? 'h2' : 'p')
  return (
    <Element id={id} className={cn(textVariants({ variant, clamp }), className)}>
      {children}
    </Element>
  )
}
