import React from 'react'

import { cn } from '@/platform/lib/cn'

import type { LabelledMetaItem } from './MetaList'

/*
 * The groove: two hairlines side by side, a darker one (`input`) and the theme's accent directly
 * beside it, so the line reads as a tiny cut. The accent hairline is a shadow of the dark one, so a
 * corner stays one shape. Theme tokens only. The class names are written out whole so Tailwind sees
 * them.
 */

/** The line along the metadata's mid-height to the column's edge: the accent sits just under it */
const LINE = 'h-0 self-center border-t border-input shadow-[0_1px_0_0_var(--color-accent)]'

/**
 * The part that passes over the metadata: from its mid-height up, across the top and down again,
 * drawn by one pseudo-element sized to the metadata's own box, so nothing is measured in code. The
 * accent hairline runs just inside the dark one (top, left and right).
 */
const HAT =
  'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:bottom-1/2 before:border-x before:border-t before:border-input before:shadow-[inset_0_1px_0_0_var(--color-accent),inset_1px_0_0_0_var(--color-accent),inset_-1px_0_0_0_var(--color-accent)] before:content-[""]'

export type MetaBarProps = {
  /** Author and date for a post, when and where for an event */
  items: LabelledMetaItem[]
  className?: string
}

/*
 * The metadata bar of a post or an event page (#1002, the industry's "byline" or "meta bar"): one
 * thin line of small text at the top right of the article's column, with its labels kept and a
 * hairline between the items. It has no box: a groove line runs across the column at the text's
 * mid-height, rises just before the text, passes over it and comes back down, then goes on a short
 * way to the column's right edge (a tab shape, square, not a pill).
 *
 * Below `sm` the items stack, right-aligned, one per line, and the line follows: the metadata takes
 * the row and the line runs over it. From `sm` they sit in one row, and a long value (a venue)
 * wraps inside its own item. The line is decoration and hidden from assistive technology; the
 * metadata is a description list of real text.
 */
export function MetaBar({ items, className }: MetaBarProps) {
  if (items.length === 0) return null

  return (
    <div className={cn('mb-10 flex items-stretch', className)}>
      <span aria-hidden="true" className={cn('min-w-0 flex-1', LINE)} />
      <dl
        className={cn(
          'relative flex min-w-0 px-3 py-2 max-sm:flex-col max-sm:items-end sm:flex-row',
          HAT,
        )}
      >
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              'flex min-w-0 items-baseline gap-1.5 max-sm:justify-end',
              index > 0 && 'sm:border-l sm:border-border sm:pl-3',
              index < items.length - 1 && 'sm:pr-3',
            )}
          >
            <dt className="shrink-0 text-[0.625rem] font-medium tracking-widest text-muted-foreground uppercase">
              {item.label}
            </dt>
            <dd className="min-w-0 text-xs break-words text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
      <span aria-hidden="true" className={cn('w-6 shrink-0', LINE)} />
    </div>
  )
}
