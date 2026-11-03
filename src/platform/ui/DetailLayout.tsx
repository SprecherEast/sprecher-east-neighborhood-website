import React from 'react'

import { cn } from '@/platform/lib/cn'

export type DetailLayoutProps = {
  /** The page's main content */
  children: React.ReactNode
  /** What goes beside it: related items, a call to action */
  aside: React.ReactNode
  /**
   * The article's "On this page" menu (`OnThisPage`, #574). Given, it takes the right-hand column
   * from `lg` (a bar above the article before that) and the aside moves below the article.
   */
  toc?: React.ReactNode
  className?: string
}

/*
 * A post's or an event's page under its hero (#434): the content, with a sidebar that sits below it
 * on phones and tablets and sticks beside it from `lg`, where there is room for both. With a
 * `toc`, the menu is what sticks beside the article, and the sidebar reads below it at every width.
 */
export function DetailLayout({ children, aside, toc, className }: DetailLayoutProps) {
  return (
    <div className={cn('container lg:grid lg:grid-cols-[1fr_18rem] lg:gap-8', className)}>
      {toc && <div className="max-lg:contents lg:col-start-2 lg:row-start-1">{toc}</div>}
      <div className={cn('min-w-0', toc && 'lg:col-start-1 lg:row-start-1')}>{children}</div>
      <aside
        className={cn(
          'mt-12 space-y-6',
          toc ? 'lg:col-span-2 lg:max-w-[48rem]' : 'lg:sticky lg:top-24 lg:mt-0 lg:self-start',
        )}
      >
        {aside}
      </aside>
    </div>
  )
}
