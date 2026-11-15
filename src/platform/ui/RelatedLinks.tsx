import React, { useId } from 'react'

import { Link } from './Link'
import { Text } from './Text'

export type RelatedLink = { href: string; label: string }

/**
 * A titled list of links to related pages, for the related content of a page (`DetailLayout`'s
 * `aside`): under the content on a phone, in the rail beside it from `lg`. Each link is a tap
 * tall. Shows nothing without items.
 */
export function RelatedLinks({
  title,
  items,
  className,
}: {
  title: string
  items: readonly RelatedLink[]
  className?: string
}) {
  const headingId = useId()

  if (items.length === 0) return null

  return (
    <nav aria-labelledby={headingId} className={className}>
      <Text variant="label" as="h2" id={headingId} className="mb-2">
        {title}
      </Text>
      <ul className="-ml-3">
        {items.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} variant="nav" size="sm" className="min-h-11 w-full">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
