import React from 'react'

import { cn } from '@/platform/lib/cn'

import { DETAIL_GRID } from './layoutSizes'

export type DetailLayoutProps = {
  /** The page's main content */
  children: React.ReactNode
  /** The related content: related items, a call to action. Hidden when it renders nothing */
  aside: React.ReactNode
  /**
   * The article's "On this page" menu (`OnThisPage`, #574). Given, it leads the rail from `lg` (a
   * bar above the article before that), with a divider between it and the related content. Pass
   * nothing when the article has no menu (`articleToc` does): an element that renders nothing
   * would still get the divider.
   */
  toc?: React.ReactNode
  className?: string
}

/*
 * A post's or an event's page under its header (#434, #677). From `lg` there are two columns, the
 * rail on the left and the article beside it. The rail holds the page menu, a divider, then the
 * related content, and sticks as one piece, scrolling inside itself when it is taller than the
 * screen. Below `lg` it is one column in reading order: the page menu bar, the article, then the
 * related content under it, never directly under the page menu.
 *
 * The rail's padding and the same negative margin give the links at its edges room for their focus
 * ring, which the rail's own scrolling would otherwise clip.
 *
 * The rail comes first in the markup and `order` moves the related content below the article on
 * small screens (`contents` lets the rail's parts take part in that order), so on a wide screen
 * the reading and tab order are the same as what is on the screen. The cost: on a small screen a
 * keyboard or screen-reader user reaches the related content before the article text (#677).
 */
export function DetailLayout({ children, aside, toc, className }: DetailLayoutProps) {
  const hasAside = aside !== null && aside !== undefined && aside !== false
  // With neither part there is no empty column: the article takes the whole width
  const hasRail = Boolean(toc) || hasAside

  return (
    <div
      className={cn(
        'container',
        hasRail && ['max-lg:flex max-lg:flex-col', DETAIL_GRID],
        className,
      )}
    >
      {hasRail && (
        <div
          data-detail-rail
          className="max-lg:contents lg:sticky lg:top-[var(--anchor-offset)] lg:-m-1 lg:max-h-[calc(100svh-var(--anchor-offset)-1rem)] lg:self-start lg:overflow-y-auto lg:p-1"
        >
          {toc}
          {hasAside && (
            <aside
              className={cn(
                'mt-12 space-y-6 empty:hidden max-lg:order-3',
                toc ? 'lg:mt-6 lg:border-t lg:border-border lg:pt-6' : 'lg:mt-0',
              )}
            >
              {aside}
            </aside>
          )}
        </div>
      )}
      <div className="min-w-0 max-lg:order-2">{children}</div>
    </div>
  )
}
