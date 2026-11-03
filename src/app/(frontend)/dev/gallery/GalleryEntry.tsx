import React from 'react'

import { cn } from '@/platform/lib/cn'
import { HEADER_SCROLL_MARGIN } from '@/platform/ui/scrollMargin'
import { Text } from '@/platform/ui/Text'

/** One component in the gallery: its name as the heading, then its variants */
export function GalleryEntry({
  name,
  description,
  children,
}: {
  name: string
  description?: string
  children: React.ReactNode
}) {
  const id = `gallery-${name.toLowerCase()}`
  return (
    <section
      aria-labelledby={id}
      className={cn(HEADER_SCROLL_MARGIN, 'border-t border-border py-10')}
    >
      <Text variant="section" id={id}>
        {name}
      </Text>
      {description && (
        <Text variant="small" className="mt-2 max-w-prose">
          {description}
        </Text>
      )}
      <div className="mt-6 space-y-8">{children}</div>
    </section>
  )
}

/**
 * One variant or state of a component, under a small label. The label is an `h3`, or a `p` where
 * the sample holds an `h1` (a page header), so headings never skip a level after it.
 */
export function GalleryVariant({
  label,
  labelAs = 'h3',
  className,
  children,
}: {
  label: string
  labelAs?: 'h3' | 'p'
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <Text variant="label" as={labelAs} className="mb-3">
        {label}
      </Text>
      <div className={cn('flex flex-wrap items-start gap-4', className)}>{children}</div>
    </div>
  )
}
