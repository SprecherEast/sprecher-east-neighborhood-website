import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * A short label, such as a post's or an event's category (#418). `category` is the pill on cards
 * and plain pages: primary-strong on the primary tint, which the theme contract checks at 4.5:1
 * on the page, a surface and a card (the plain primary text it had was 3.9 to 4.5:1). `on-image`
 * sits on a photo, on a scrim of its own (60%), so it passes even over white (`SCRIM_PAIRS`).
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
 * is one the theme contract checks. `size` is `sm` (the default) or `md`, slightly bigger words and
 * icon for a mark that must stand out among small labels (#952).
 */
const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 font-medium [overflow-wrap:anywhere] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        category: 'bg-primary/10 text-primary-strong',
        'on-image':
          'border border-on-image/30 bg-scrim/60 tracking-wide text-on-image uppercase backdrop-blur-sm',
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
        sm: 'text-xs [&_svg]:size-3.5',
        md: 'py-1.5 text-sm [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'category', size: 'sm' },
  },
)

export type BadgeProps = VariantProps<typeof badgeVariants> & {
  className?: string
  children: React.ReactNode
}

export function Badge({ variant, size, className, children }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)}>{children}</span>
}

/** Badges in a row that wraps on small screens */
export function BadgeList({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('flex flex-wrap gap-2', className)}>{children}</div>
}
