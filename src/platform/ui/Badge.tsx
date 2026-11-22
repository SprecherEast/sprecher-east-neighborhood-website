import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * A short label, such as a post's or an event's category (#418). `category` is the pill on cards
 * and plain pages: primary-strong on the primary tint, which the theme contract checks at 4.5:1
 * on the page, a surface and a card (the plain primary text it had was 3.9 to 4.5:1). Over a photo,
 * `BadgeList plated` sets each badge on a solid plate instead.
 * `status` marks a state the reader must not miss, such as a cancelled event (#122):
 * destructive-strong on the destructive tint, which the contract checks like `Alert`'s error tone
 * (`TINTED_PAIRS`). Its words say the state, and an icon may go before them, so colour is never
 * the only signal. `official` marks an official meeting (#122): the category pill's checked pair
 * (primary-strong on the primary tint), set apart by its border, weight and icon rather than a
 * new colour, so it reads as distinct but calm. Three tones mark how certain a step is, for the
 * editorial timeline (#507), each with its own words: `current` (primary-foreground on the primary
 * fill, the button pair) for what's next; `caution` (warning-strong on the warning tint, `Alert`'s
 * warning pair) for what depends on something else; `neutral` (muted-foreground on muted) for what
 * is expected later. `open` (success-strong on the success tint) and `done` (done-strong on the
 * done tint, purple) mark whether work is under way or finished, each with its own words and
 * icon (#946); `outline` is a label with no fill, so a state mark stands out beside it. Every pair
 * is one the theme contract checks. `size` is `sm` (the default), `xs` (tighter padding, for a row shared with a label) or `md`, slightly bigger words and
 * icon for a mark that must stand out among small labels (#952). Given `onPress`, it is a `button`
 * instead of a label (#1417): the same look with a shadow of 3 px or less, a one-pixel lift on hover
 * (not for a reader who asked for less movement), a focus ring and a tap area a little past its box.
 */
const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 font-medium [overflow-wrap:anywhere] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        category: 'bg-primary/10 text-primary-strong',
        status:
          'border border-destructive/30 bg-destructive/10 font-semibold text-destructive-strong',
        official: 'border border-primary/30 bg-primary/10 font-semibold text-primary-strong',
        current: 'bg-primary-fill font-semibold text-primary-foreground',
        caution: 'border border-warning/40 bg-warning/10 font-semibold text-warning-strong',
        neutral: 'border border-border bg-muted text-muted-foreground',
        open: 'border border-success/40 bg-success/10 font-semibold text-success-strong',
        done: 'border border-done/40 bg-done/10 font-semibold text-done-strong',
        outline: 'border border-border font-normal text-muted-foreground',
      },
      size: {
        // Tighter still, for a badge that shares a row with a label on a phone (#1118)
        xs: 'gap-1 px-2 py-0.5 text-xs [&_svg]:size-3',
        sm: 'text-xs [&_svg]:size-3.5',
        md: 'py-1.5 text-sm [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'category', size: 'sm' },
  },
)

/** What a badge that can be pressed adds to its look, so it shows it is a button */
const PRESSABLE =
  'relative cursor-pointer shadow-sm transition-[box-shadow,translate] hover:shadow-md motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring after:absolute after:-inset-1.5 after:content-[""]'

export type BadgeProps = VariantProps<typeof badgeVariants> & {
  className?: string
  children: React.ReactNode
  /** Makes the badge a button that does this when pressed */
  onPress?: () => void
}

export function Badge({ variant, size, className, children, onPress }: BadgeProps) {
  const look = cn(badgeVariants({ variant, size }), className)
  if (!onPress) return <span className={look}>{children}</span>
  return (
    <button type="button" onClick={onPress} className={cn(look, PRESSABLE)}>
      {children}
    </button>
  )
}

/**
 * Badges in a row that wraps on small screens. `plated` lays each on a solid plate of the surface,
 * for a row over a photo: a badge's tint is see-through, so a photo behind would change its
 * contrast. On the plain surface the plate cannot be seen (#1024).
 */
export function BadgeList({
  className,
  plated = false,
  children,
}: {
  className?: string
  plated?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {plated
        ? React.Children.toArray(children).map((badge, index) => (
            <span key={index} className="flex max-w-full rounded-full bg-surface">
              {badge}
            </span>
          ))
        : children}
    </div>
  )
}
