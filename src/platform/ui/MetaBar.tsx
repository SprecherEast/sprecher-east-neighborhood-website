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

export type MetaBarAlign = 'start' | 'end'

export type MetaBarProps = {
  /** Author and date for a post, when and where for an event */
  items: MetaBarItem[]
  /**
   * `start` (the default, an event's): the items grouped at the left, stacked in two columns on a
   * phone. `end` (a post's, #1055): smaller text, one row at every width ending on the right edge,
   * where a value too long for the row is cut with an ellipsis and never wraps.
   */
  align?: MetaBarAlign
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
 *
 * A post's bar is `align="end"` (#1055): the same labels and groove, in the smaller type, always one
 * row ending on the column's right edge, with a long name cut by an ellipsis rather than wrapped.
 */
export function MetaBar({ items, align = 'start', className }: MetaBarProps) {
  if (items.length === 0) return null
  // With a cut value in the row it is the one that gives up width; the others stay whole
  const hasCutValue = items.some((item) => item.title)
  const end = align === 'end'

  return (
    <div className={cn('mb-10', className)}>
      <div className="pb-2">
        <dl
          className={cn(
            'max-w-full min-w-0 items-baseline',
            end
              ? 'flex justify-end'
              : 'grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1 md:flex md:gap-x-0',
          )}
        >
          {items.map((item, index) => (
            <div
              key={item.label}
              className={cn(
                end
                  ? 'flex min-w-0 items-baseline gap-1.5'
                  : 'contents md:flex md:min-w-0 md:items-baseline md:gap-1.5',
                // The cut value gives up width first, so the other items stay on one line
                hasCutValue && !item.title && (end ? 'shrink-0' : 'md:shrink-0'),
                index > 0 &&
                  (end ? 'border-l border-border pl-3' : 'md:border-l md:border-border md:pl-3'),
                index < items.length - 1 && (end ? 'pr-3' : 'md:pr-3'),
              )}
            >
              <dt className="shrink-0 text-fine font-medium tracking-widest text-muted-foreground uppercase">
                {item.label}
              </dt>
              <dd
                className={cn(
                  'flex min-w-0 break-words text-foreground',
                  end ? 'text-fine' : 'text-xs',
                )}
              >
                {item.title ? (
                  <span
                    className={cn('min-w-0 truncate', !end && 'md:max-w-80')}
                    title={item.title}
                  >
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
