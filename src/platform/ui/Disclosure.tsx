import { cva } from 'class-variance-authority'
import { ChevronDown } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { cardVariants } from './Card'
import { DisclosureSummary } from './DisclosureSummary.client'
import { TOUCH_MIN_HEIGHT } from './layoutSizes'
import { REVEAL_SCROLL_MARGIN } from './scrollMargin'

/*
 * The one open-and-close box (#610): a native `<details>` with the kit's summary row, chevron and
 * focus ring, so nothing outside the kit writes a raw `details` or `summary`. It works without
 * JavaScript; with it, a box a reader opens is scrolled into view (`DisclosureSummary`, #1152), except
 * the `bar`, which is already pinned under the site header. `card` is a question that opens to its answer, in the kit's card look; `bar` is the full-width
 * row under the site header that holds the "On this page" list on small screens; `link` is a bare
 * link-coloured row with no box, for "See the smaller pieces" inside a chart (#866); `row` is the card
 * look with no box of its own: a few rows go in one card, split by divider lines, and a closed row is
 * only as tall as its summary (#1111, #1118); `listRow` is a row inside a list (a receipt's), with no
 * side padding, so the list's own indent places it, and a label in `text-list-row`, a little larger
 * than the list's rows; its body goes back to body text (#1163).
 */
// The summary row and chevron the two card-like looks (`card` and `row`) share: one definition each, so they cannot drift
const CARD_BOX = cardVariants({ variant: 'elevated', padding: 'sm' })
const CARD_SUMMARY = cn(TOUCH_MIN_HEIGHT, 'font-medium')
const CARD_CHEVRON = 'size-5 text-foreground'

const summaryVariants = cva(
  'flex cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden',
  {
    variants: {
      variant: {
        card: cn(CARD_SUMMARY, 'focus-visible:outline-offset-2'),
        // Inside a card that clips its corners, so the ring is drawn inside the row
        row: cn(CARD_SUMMARY, 'focus-visible:-outline-offset-2 max-[24rem]:text-sm'),
        listRow: cn(CARD_SUMMARY, 'text-list-row focus-visible:-outline-offset-2'),
        bar: 'min-h-[var(--section-bar-height)] px-4 text-sm font-semibold text-foreground focus-visible:-outline-offset-2 md:px-8',
        link: cn(
          TOUCH_MIN_HEIGHT,
          'justify-start text-sm font-semibold text-primary-strong focus-visible:outline-offset-2',
        ),
      },
    },
  },
)

// The chevron turns for its own box only: `group-open:` would also fire for any open box around it (#967)
const chevronVariants = cva(
  'shrink-0 transition-transform duration-200 [details[open]>summary_&]:rotate-180',
  {
    variants: {
      variant: {
        card: CARD_CHEVRON,
        row: CARD_CHEVRON,
        listRow: 'size-4 text-foreground',
        bar: 'size-5',
        link: 'size-4',
      },
    },
  },
)

const bodyVariants = cva('', {
  variants: {
    variant: {
      card: 'mt-4 border-t border-border pt-4',
      row: 'border-t border-border py-4',
      listRow: 'border-t border-border py-4 text-base',
      bar: 'border-t border-border',
      link: 'mt-1',
    },
  },
})

export type DisclosureProps = {
  variant: 'card' | 'row' | 'listRow' | 'bar' | 'link'
  /** The row that stays visible; clicking it opens and closes the box */
  summary: React.ReactNode
  /** Starts open; the reader opens and closes it after that */
  defaultOpen?: boolean
  /** The `<details>` element, for closing it from the outside (`removeAttribute('open')`) */
  ref?: React.Ref<HTMLDetailsElement>
  className?: string
  /** Classes for the content under the summary, for example a height limit */
  bodyClassName?: string
  children: React.ReactNode
  /**
   * Called when a reader is about to open it, from the summary's click, while it is still closed,
   * so the caller can get the content ready before it shows (#1165); not on the pinned `bar`
   */
  onOpening?: () => void
}

export function Disclosure({
  variant,
  summary,
  defaultOpen,
  ref,
  className,
  bodyClassName,
  children,
  onOpening,
}: DisclosureProps) {
  // The bar is pinned under the site header, so it is never scrolled to: it keeps the plain row
  const reveal = variant !== 'bar'
  const Summary = reveal ? DisclosureSummary : 'summary'

  return (
    <details
      ref={ref}
      open={defaultOpen || undefined}
      className={cn(
        variant === 'card' && CARD_BOX,
        variant === 'row' && 'px-3',
        reveal && REVEAL_SCROLL_MARGIN,
        className,
      )}
    >
      <Summary
        className={summaryVariants({ variant })}
        {...(reveal && onOpening ? { onOpening } : {})}
      >
        <span className={cn('min-w-0', variant !== 'link' && 'flex-1')}>{summary}</span>
        <ChevronDown aria-hidden="true" className={chevronVariants({ variant })} />
      </Summary>
      <div className={cn(bodyVariants({ variant }), bodyClassName)}>{children}</div>
    </details>
  )
}
