import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'
import { PAGE_MIN_HEIGHT } from './layoutSizes'

/*
 * What a list or page shows when it has nothing to show (#416): a title, an optional line on what
 * to do, and an optional action. Centred, as the design guidelines allow for empty states.
 * `boxed` sits in a list's place, `plain` under a search or filter, `page` fills a page of its own
 * (the 404), whose title is then the page's heading.
 */
const emptyStateVariants = cva('flex flex-col items-center text-center', {
  variants: {
    variant: {
      boxed: 'rounded-2xl border border-border bg-surface p-8 md:p-12',
      plain: 'py-12',
      page: `${PAGE_MIN_HEIGHT} justify-center py-28`,
    },
  },
  defaultVariants: { variant: 'boxed' },
})

export type EmptyStateProps = VariantProps<typeof emptyStateVariants> & {
  title: React.ReactNode
  description?: React.ReactNode
  /** A `Button` or `Link` to go somewhere useful */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ variant, title, description, action, className }: EmptyStateProps) {
  const isPage = variant === 'page'
  const Title = isPage ? 'h1' : 'p'

  return (
    <div className={cn(emptyStateVariants({ variant }), className)}>
      <Title
        className={
          isPage
            ? 'text-6xl font-bold text-foreground'
            : 'text-lg font-semibold text-balance text-foreground'
        }
      >
        {title}
      </Title>
      {description && (
        <p className={cn('max-w-prose text-muted-foreground', isPage ? 'mt-2 text-lg' : 'mt-2')}>
          {description}
        </p>
      )}
      {action && <div className={isPage ? 'mt-8' : 'mt-6'}>{action}</div>}
    </div>
  )
}
