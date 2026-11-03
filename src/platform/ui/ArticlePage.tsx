import React from 'react'

import { cn } from '@/platform/lib/cn'

import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { DetailLayout } from './DetailLayout'
import { JsonLd } from './JsonLd'
import { LivePreviewListener } from './LivePreviewListener.client'
import { PageHeader, type PageHeaderProps } from './PageHeader'

export type ArticlePageProps = {
  /** The article's structured data (schema.org), from its module */
  jsonLd: Record<string, unknown>
  /**
   * The redirects for a valid page too. It comes from the site module, which `platform/` can't
   * import, so the page passes it in.
   */
  redirects: React.ReactNode
  /** Draft mode: refresh the page when an editor saves in Admin's Live Preview (#363) */
  draft: boolean
  /** The header has a photo: the text starts clear of it, with a little room under it */
  hasHeroImage: boolean
  header: PageHeaderProps
  breadcrumbs: BreadcrumbItem[]
  /** The "On this page" menu, when the article has headings to list */
  toc?: React.ReactNode
  /** The sidebar: related items, a call to action */
  aside: React.ReactNode
  /** The article's top and bottom space, which a post and an event set differently */
  className?: string
  children: React.ReactNode
}

/*
 * A post's or an event's page: the article with its structured data, header, breadcrumbs, and the
 * `DetailLayout` of text and sidebar. Written once for both; each page keeps what is its own (the
 * header's facts, the text above the body, the sidebar).
 */
export function ArticlePage({
  jsonLd,
  redirects,
  draft,
  hasHeroImage,
  header,
  breadcrumbs,
  toc,
  aside,
  className,
  children,
}: ArticlePageProps) {
  return (
    <article className={className}>
      <JsonLd data={jsonLd} />

      {redirects}

      {draft && <LivePreviewListener />}

      <PageHeader {...header} />

      <div className={cn(hasHeroImage && 'pt-8')}>
        <div className="container">
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <DetailLayout toc={toc} aside={aside}>
          {children}
        </DetailLayout>
      </div>
    </article>
  )
}
