import { cva, type VariantProps } from 'class-variance-authority'
import NextLink from 'next/link'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * The one card (#163, docs/ui/component-set.md): a box with parts. The variants keep today's looks
 * (the owner's choice, 2026-10-26, #426): `elevated` content cards (border and shadow; the border
 * still shows in dark mode, where shadows barely do), `outline` form boxes, `muted` panels inside
 * a page, the `tinted` sidebar box, and the toned `success`, `danger` and `neutral` boxes. Every
 * card has the same corners, and an `interactive` card, one whose title is a link, has the one
 * hover: a deeper shadow and a small lift.
 */
export const cardVariants = cva('relative min-w-0 rounded-2xl', {
  variants: {
    variant: {
      elevated: 'border border-border bg-card shadow-sm',
      outline: 'border border-border bg-background',
      muted: 'border border-border bg-surface',
      tinted: 'bg-primary/10',
      // Boxes that carry a tone, such as an outcome of a decision (#517). The tone is never the
      // only cue: the content pairs it with an icon and words
      success: 'border border-primary/40 bg-primary/10',
      danger: 'border border-destructive/30 bg-destructive/10',
      neutral: 'border border-border bg-muted',
    },
    padding: {
      // Media cards stack an image and a `CardBody` that grows to the card's height; the corners
      // clip the image. Other cards don't clip, so focus outlines inside them show in full
      none: 'flex flex-col overflow-hidden',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-6 md:p-8',
    },
    interactive: {
      // The ring goes round the whole card when its stretched title link has keyboard focus, in
      // place of the link's own outline
      true: 'group transition-all duration-200 hover:shadow-md has-[[data-card-link]:focus-visible]:ring-2 has-[[data-card-link]:focus-visible]:ring-ring motion-safe:hover:-translate-y-0.5 [&_[data-card-link]:focus-visible]:outline-none',
      false: '',
    },
  },
  defaultVariants: { variant: 'elevated', padding: 'md', interactive: false },
})

type CardElement = 'article' | 'div' | 'section'

export type CardProps = VariantProps<typeof cardVariants> &
  Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'> & {
    /** `article` for a self-contained item in a list, `section` for a panel with a heading */
    as?: CardElement
    className?: string
    children: React.ReactNode
  }

export function Card({
  as: Element = 'div',
  variant,
  padding,
  interactive,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Element {...rest} className={cn(cardVariants({ variant, padding, interactive }), className)}>
      {children}
    </Element>
  )
}

/** A full-bleed image or placeholder at the top of a card with `padding="none"` */
export function CardMedia({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('relative aspect-video w-full overflow-hidden', className)}>{children}</div>
  )
}

/** The padded content under a `CardMedia`; grows so a footer sits at the bottom of the card */
export function CardBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('flex flex-1 flex-col p-6', className)}>{children}</div>
}

/**
 * The card's heading. With `href`, its link stretches over the whole card, so the card is
 * clickable but the link's accessible name is just the title (not every line of the card).
 * Give the card `interactive` for the hover, and for a focus ring round the whole card in place of
 * the link's own outline.
 */
export function CardTitle({
  as: Heading = 'h3',
  href,
  className,
  children,
}: {
  as?: 'h2' | 'h3' | 'h4'
  href?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Heading
      className={cn('text-lg leading-snug font-semibold text-balance text-foreground', className)}
    >
      {href ? (
        <NextLink
          href={href}
          data-card-link
          className="rounded-sm transition-colors duration-200 group-hover:text-primary-strong after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {children}
        </NextLink>
      ) : (
        children
      )}
    </Heading>
  )
}

/** A row of small facts: a date, categories. Wraps on small screens. */
export function CardMeta({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 text-sm text-muted-foreground', className)}
    >
      {children}
    </div>
  )
}

/** Actions or tags at the bottom of the card */
export function CardFooter({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('mt-auto flex flex-wrap gap-3 pt-3', className)}>{children}</div>
}
