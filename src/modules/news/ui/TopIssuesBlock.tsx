import React, { useId } from 'react'

import { DateTime } from '@/platform/ui/DateTime'
import { Link } from '@/platform/ui/Link'
import { Section } from '@/platform/ui/Section'
import { Text } from '@/platform/ui/Text'

import type { TopIssue, TopIssuesBlockProps } from '../domain/topIssues'

function Issue({ title, summary, link }: TopIssue) {
  return (
    <li className="py-3 ps-1 first:pt-0 last:pb-0">
      {/* Text-styled, but 44 px tall: it stands alone, so it's a touch target (WCAG 2.5.8) */}
      <Link
        href={link.href}
        external={link.external}
        variant="inline"
        className="inline-flex min-h-11 items-center text-lg font-semibold text-pretty"
      >
        {title}
      </Link>
      {summary && (
        <p className="mt-1 max-w-prose leading-relaxed text-muted-foreground">{summary}</p>
      )}
    </li>
  )
}

/**
 * "Top issues" (#484), a page-builder block: the short list editors keep of what matters to the
 * neighborhood right now, each title linking to its post, page or forum thread, with the day the
 * list was last reviewed, most important first. The mapper leaves out what can't be shown; with
 * nothing left the block draws nothing at all.
 */
export function TopIssuesBlock({ id, heading, reviewedAt, items }: TopIssuesBlockProps) {
  const headingId = useId()
  if (items.length === 0) return null

  return (
    <Section spacing="sm" id={id ? `block-${id}` : undefined} aria-labelledby={headingId}>
      <div className="max-w-prose">
        <Text variant="overline" className="mb-2">
          Neighborhood
        </Text>
        <Text variant="section" id={headingId}>
          {heading}
        </Text>
        {reviewedAt && (
          <Text variant="small" className="mt-1">
            Updated <DateTime value={reviewedAt} format="long" />
          </Text>
        )}
        <ol className="mt-6 list-decimal divide-y divide-border ps-6 marker:font-semibold marker:text-primary-strong">
          {items.map((item, index) => (
            // Index keys: an editor may give two issues the same title
            <Issue key={index} {...item} />
          ))}
        </ol>
      </div>
    </Section>
  )
}
