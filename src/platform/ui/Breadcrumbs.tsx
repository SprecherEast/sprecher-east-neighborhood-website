import { ChevronRight, House } from 'lucide-react'
import React from 'react'

import { JsonLd } from './JsonLd'
import { Link } from './Link'
import { getServerSideURL } from '@/platform/lib/getURL'

export type BreadcrumbItem = {
  label: string
  href?: string
}

/**
 * Renders a flat breadcrumb trail with BreadcrumbList JSON-LD structured data.
 * For hierarchical category pages (which use @payloadcms/plugin-nested-docs),
 * use the breadcrumbs field from the collection instead.
 *
 * The trail stays on one line: the earlier crumbs keep their size and the current page, the last
 * one, is cut with an ellipsis when it doesn't fit (its full text stays in the page for screen
 * readers). A first crumb that links to `/` is drawn as a home icon.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const serverURL = getServerSideURL()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${serverURL}${item.href}` } : {}),
    })),
  }

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="mb-6 max-w-full min-w-0">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const isHome = index === 0 && item.href === '/'
            return (
              <li
                key={index}
                className={
                  isLast ? 'flex min-w-0 items-center gap-1' : 'flex shrink-0 items-center gap-1'
                }
              >
                {index > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0" />}
                {isLast || !item.href ? (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    title={item.label}
                    className="truncate px-2 font-semibold text-foreground"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    variant="crumb"
                    icon={isHome ? <House aria-hidden="true" /> : undefined}
                    iconOnly={isHome}
                    className={isHome ? 'min-w-11 justify-center lg:min-w-9' : undefined}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
