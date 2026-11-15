import React from 'react'

import { Link } from './Link'

export type JumpLink = { id: string; label: string }

/**
 * A row of links that jump to sections further down the same page, such as the groups of the
 * resources page. They are plain `#id` links, so they work without scripting; the section's
 * heading carries the id and `SECTION_SCROLL_MARGIN` so the sticky header does not cover it. The
 * links wrap onto more lines instead of scrolling sideways. Shows nothing without items.
 */
export function JumpLinks({
  label,
  items,
  className,
}: {
  /** What the navigation is, for screen readers */
  label: string
  items: readonly JumpLink[]
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-1">
        {items.map(({ id, label: text }) => (
          <li key={text}>
            <Link href={`#${id}`} variant="nav" size="sm" className="min-h-11 border border-border">
              {text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
