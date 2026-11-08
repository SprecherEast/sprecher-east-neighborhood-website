import { cva } from 'class-variance-authority'
import { ChevronDown } from 'lucide-react'
import React from 'react'

import { cn } from '@/platform/lib/cn'

import { cardVariants } from './Card'
import { TOUCH_MIN_HEIGHT } from './layoutSizes'

/*
 * The one open-and-close box (#610): a native `<details>` with the kit's summary row, chevron and
 * focus ring, so nothing outside the kit writes a raw `details` or `summary`. It works without
 * JavaScript. `card` is a question that opens to its answer, in the kit's card look; `bar` is the full-width
 * row under the site header that holds the "On this page" list on small screens; `link` is a bare
 * link-coloured row with no box, for "See the smaller pieces" inside a chart (#866).
 */
const summaryVariants = cva(
  'flex cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden',
  {
    variants: {
      variant: {
        card: cn(TOUCH_MIN_HEIGHT, 'font-medium focus-visible:outline-offset-2'),
        bar: 'min-h-[var(--section-bar-height)] px-4 text-sm font-semibold text-foreground focus-visible:-outline-offset-2 md:px-8',
        link: cn(
          TOUCH_MIN_HEIGHT,
          'justify-start text-sm font-semibold text-primary-strong focus-visible:outline-offset-2',
        ),
      },
    },
  },
)

const chevronVariants = cva('shrink-0 transition-transform duration-200 group-open:rotate-180', {
  variants: {
    variant: {
      card: 'size-4 text-muted-foreground',
      bar: 'size-5',
      link: 'size-4',
    },
  },
})

const bodyVariants = cva('', {
  variants: {
    variant: {
      card: 'mt-4 border-t border-border pt-4',
      bar: 'border-t border-border',
      link: 'mt-1',
    },
  },
})

export type DisclosureProps = {
  variant: 'card' | 'bar' | 'link'
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
}

export function Disclosure({
  variant,
  summary,
  defaultOpen,
  ref,
  className,
  bodyClassName,
  children,
}: DisclosureProps) {
  return (
    <details
      ref={ref}
      open={defaultOpen || undefined}
      className={cn(
        'group',
        variant === 'card' && cardVariants({ variant: 'elevated', padding: 'sm' }),
        className,
      )}
    >
      <summary className={summaryVariants({ variant })}>
        <span className={cn('min-w-0', variant !== 'link' && 'flex-1')}>{summary}</span>
        <ChevronDown aria-hidden="true" className={chevronVariants({ variant })} />
      </summary>
      <div className={cn(bodyVariants({ variant }), bodyClassName)}>{children}</div>
    </details>
  )
}
