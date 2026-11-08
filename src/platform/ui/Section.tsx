import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { PAGE_MIN_HEIGHT } from './layoutSizes'

/*
 * A band of the page (#439, docs/ui/component-set.md): its background (`tone`), its vertical
 * padding (`spacing`), and how wide its content may run (`width`). `page` is the site's container,
 * `prose` a comfortable reading width, `narrow` a single form or message. `center` spacing sets a
 * short page in the middle of the screen, as the log-in and confirmation pages are; `sm` is the
 * page-builder blocks' band. `brand` is the call-to-action band: the brand gradient in both modes,
 * scoped to the dark theme, so links, outlines and `Button · inverse` read on it.
 */
const sectionVariants = cva('', {
  variants: {
    tone: {
      plain: '',
      surface: 'bg-surface',
      brand: 'bg-gradient-to-br from-primary-fill to-primary-fill-hover text-primary-foreground',
    },
    spacing: {
      none: '',
      sm: 'py-8 md:py-10',
      md: 'py-10 md:py-14',
      lg: 'py-16',
      center: `flex ${PAGE_MIN_HEIGHT} items-center py-16`,
    },
  },
  defaultVariants: { tone: 'plain', spacing: 'lg' },
})

const widthClass = {
  page: '',
  prose: 'mx-auto max-w-prose',
  narrow: 'mx-auto max-w-md',
} as const

/**
 * Where the band sits: `section` (default) is its own band of the page and brings the container
 * and the vertical padding; `inline` sits inside a layout that already owns the space (a cell of
 * a section block), so it draws neither.
 */
export type SectionPlacement = 'section' | 'inline'

export type SectionProps = VariantProps<typeof sectionVariants> & {
  placement?: SectionPlacement
  width?: keyof typeof widthClass
  /** `div` where it only sets the width and spacing, not a part of the page with a heading */
  as?: 'section' | 'div'
  /** An anchor to link to the band */
  id?: string
  'aria-labelledby'?: string
  className?: string
  children: React.ReactNode
}

export function Section({
  width = 'page',
  tone,
  spacing,
  as: Element = 'section',
  placement = 'section',
  className,
  children,
  ...rest
}: SectionProps) {
  if (placement === 'inline') {
    return (
      <Element {...rest} className={cn(sectionVariants({ tone, spacing: 'none' }), className)}>
        {children}
      </Element>
    )
  }
  return (
    <Element
      {...rest}
      data-theme={tone === 'brand' ? 'dark' : undefined}
      className={cn(sectionVariants({ tone, spacing }), className)}
    >
      <div className="container w-full">
        {width === 'page' ? children : <div className={widthClass[width]}>{children}</div>}
      </div>
    </Element>
  )
}
