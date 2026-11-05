import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

import { cn } from '@/platform/lib/cn'

/*
 * Cards in a responsive grid (#163): one column on phones, two from `sm`, then `columns` from `lg`.
 * A list by default, so screen readers announce how many cards there are; put each card in a
 * `CardGridItem`, which stretches it to the row's height.
 */
const cardGridVariants = cva('grid grid-cols-1', {
  variants: {
    columns: {
      2: 'sm:grid-cols-2',
      3: 'sm:grid-cols-2 lg:grid-cols-3',
      4: 'sm:grid-cols-2 lg:grid-cols-4',
      // No screen-width rule: the caller sets the columns, for example by container query (#678)
      none: '',
    },
    gap: {
      sm: 'gap-4',
      md: 'gap-6 lg:gap-8',
    },
  },
  defaultVariants: { columns: 3, gap: 'md' },
})

export type CardGridProps = VariantProps<typeof cardGridVariants> & {
  /** `div` when the cards aren't a list of like items */
  as?: 'ul' | 'div'
  className?: string
  children: React.ReactNode
}

export function CardGrid({ as = 'ul', columns, gap, className, children }: CardGridProps) {
  const classes = cn(cardGridVariants({ columns, gap }), className)
  // `role="list"`: Safari drops list semantics from a list without bullets
  return as === 'ul' ? (
    <ul role="list" className={classes}>
      {children}
    </ul>
  ) : (
    <div className={classes}>{children}</div>
  )
}

/** One cell of a `CardGrid`: a list item that stretches its card to the row's height */
export function CardGridItem({
  as: Element = 'li',
  className,
  children,
}: {
  as?: 'li' | 'div'
  className?: string
  children: React.ReactNode
}) {
  return <Element className={cn('flex min-w-0 *:w-full', className)}>{children}</Element>
}
