import React from 'react'

import type { ImageRef } from '@/platform/lib/content'

import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { DetailLayout } from './DetailLayout'
import { FeaturedImage } from './FeaturedImage'
import { JsonLd } from './JsonLd'
import { LivePreviewListener } from './LivePreviewListener.client'
import { MetaBar } from './MetaBar'
import type { LabelledMetaItem } from './MetaList'
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
  /**
   * The article's picture, shown whole at the top of its column (`FeaturedImage`, #1013); never
   * cropped behind the header. Without one, nothing is drawn.
   */
  image?: ImageRef | null
  header: PageHeaderProps
  breadcrumbs: BreadcrumbItem[]
  /**
   * Facts about the article (a post's author, date and source; an event's when and where), drawn
   * as the `MetaBar` at the top right of the article column, under the picture and above the text,
   * ending on the text's right edge (#774, #1002).
   */
  byline?: LabelledMetaItem[]
  /**
   * The width class the page gives the article's text (`articleColumnClass`). The metadata bar takes
   * it too, so a text-only article's bar ends on the text's right edge, not past it (#774).
   */
  textClassName?: string
  /** The "On this page" menu, when the article has headings to list */
  toc?: React.ReactNode
  /** The related content: related items, a call to action */
  aside: React.ReactNode
  /** The article's top and bottom space, which a post and an event set differently */
  className?: string
  children: React.ReactNode
}

/*
 * A post's or an event's page: the article with its structured data, header, breadcrumbs, and the
 * `DetailLayout` of text and left rail. Written once for both; each page keeps what is its own (the
 * metadata, the text above the body, the related content).
 */
export function ArticlePage({
  jsonLd,
  redirects,
  draft,
  image,
  header,
  breadcrumbs,
  byline,
  textClassName,
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

      <div className="pt-8">
        <div className="container">
          <Breadcrumbs items={breadcrumbs} />
        </div>
        <DetailLayout toc={toc} aside={aside}>
          <FeaturedImage image={image} />
          {byline && byline.length > 0 && <MetaBar items={byline} className={textClassName} />}
          {children}
        </DetailLayout>
      </div>
    </article>
  )
}
