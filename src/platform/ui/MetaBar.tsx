import React from 'react'

import { cn } from '@/platform/lib/cn'

import type { LabelledMetaItem } from './MetaList'

/**
 * The groove: two hairlines side by side, a darker one (`input`) and the theme's accent directly
 * under it, so the line reads as a tiny cut. The accent hairline is a one-pixel shadow of the dark
 * one. Theme tokens only; the class names are written out whole so Tailwind sees them.
 */
const GROOVE = 'h-0 border-t border-input shadow-[0_1px_0_0_var(--color-accent)]'

/** A value that is too long for one line is cut with an ellipsis, and `title` holds all of it */
export type MetaBarItem = LabelledMetaItem & {
  title?: string
  /** What follows a cut value and is never cut (a format after a place) */
  suffix?: React.ReactNode
}

export type MetaBarProps = {
  /** Author and date for a post, when and where for an event */
  items: MetaBarItem[]
  className?: string
}

/*
 * The metadata bar of a post or an event page (#1002, the industry's "byline" or "meta bar"): one
 * thin line of small text at the left edge of the article's column, labels kept (small, uppercase,
 * muted) and a hairline between the items, with one straight groove line directly under it across
 * the whole column. There is no box, tab or pill: the line is the only frame, and it is the same
 * at every width.
 *
 * From `md` the items sit in one row, aligned on their text baseline, so a link or its icon never
 * lowers its neighbour, and they stay grouped at the left: a cut value is capped at 20rem, so a
 * long place never spreads them across the row. Below `md` they become a two-column list, labels in one column and values
 * in the other, both starting at the left edge, above the line. A value that is too long for one line (a place) is
 * cut with an ellipsis, with its whole text in the page (assistive technology and the Location panel have it) and in `title`, an extra for a mouse that a touch screen does not show.
 * The line is decoration and hidden from assistive technology; the metadata is a description list
 * of real text.
 */
export function MetaBar({ items, className }: MetaBarProps) {
  if (items.length === 0) return null
  // With a cut value in the row it is the one that gives up width; the others stay whole
  const hasCutValue = items.some((item) => item.title)

  return (
    <div className={cn('mb-10', className)}>
      <div className="pb-2">
        <dl className="grid max-w-full min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1 md:flex md:gap-x-0">
          {items.map((item, index) => (
            <div
              key={item.label}
              className={cn(
                'contents md:flex md:min-w-0 md:items-baseline md:gap-1.5',
                // The cut value gives up width first, so the other items stay on one line
                hasCutValue && !item.title && 'md:shrink-0',
                index > 0 && 'md:border-l md:border-border md:pl-3',
                index < items.length - 1 && 'md:pr-3',
              )}
            >
              <dt className="shrink-0 text-fine font-medium tracking-widest text-muted-foreground uppercase">
                {item.label}
              </dt>
              <dd className="flex min-w-0 text-xs break-words text-foreground">
                {item.title ? (
                  <span className="min-w-0 truncate md:max-w-80" title={item.title}>
                    {item.value}
                  </span>
                ) : (
                  <span className="min-w-0 text-balance">{item.value}</span>
                )}
                {item.suffix && <span className="shrink-0 whitespace-pre">{item.suffix}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div aria-hidden="true" className={GROOVE} />
    </div>
  )
}
