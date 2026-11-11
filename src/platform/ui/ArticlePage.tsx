import React from 'react'

import { cn } from '@/platform/lib/cn'
import type { ImageRef } from '@/platform/lib/content'

import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { DetailLayout } from './DetailLayout'
import { FeaturedImage } from './FeaturedImage'
import { JsonLd } from './JsonLd'
import { LivePreviewListener } from './LivePreviewListener.client'
import { MetaBar, type MetaBarItem } from './MetaBar'
import { PageHeader, type PageHeaderProps } from './PageHeader'

/*
 * Under the metadata bar, the picture (a float from `md`) and the page's content share one box that
 * contains the float, so what follows the article clears a picture taller than a short text. The
 * text itself (`RichText` with `besideFloat`) flows beside the picture; a panel or a button that
 * sits there is a box of its own, so from `md` it takes the room left beside the picture instead of
 * running under it. The text's own box is left out, or it would stay that narrow down the page.
 */
const BESIDE_PICTURE = 'flow-root md:[&>:not(.payload-richtext)]:flow-root'

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
   * The article's picture, shown whole under the metadata bar (`FeaturedImage`, #1013, #1023): full
   * width above the text on a phone, to the right of it from a tablet, with the text beside it. The
   * article's `RichText` takes `besideFloat`. Without a picture, nothing is drawn.
   */
  image?: ImageRef | null
  /**
   * What opens the article ahead of the picture: a row of cards, which runs the whole column and
   * can't sit beside a floated picture (`splitLeadingWideBlocks`, #1023). The picture then starts
   * beside the first text.
   */
  lead?: React.ReactNode
  header: PageHeaderProps
  breadcrumbs: BreadcrumbItem[]
  /**
   * Facts about the article (a post's author, date and source; an event's when and where), drawn
   * as the `MetaBar` at the top right of the article column, above the picture and the text, over
   * one groove line (#774, #1002).
   */
  byline?: MetaBarItem[]
  /**
   * The width class the page gives the article's text (`articleColumnClass`). The metadata bar takes
   * it too, so a text-only article's line ends where the text does, not past it (#774).
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
  lead,
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
          {byline && byline.length > 0 && <MetaBar items={byline} className={textClassName} />}
          {image ? (
            <div className={cn(BESIDE_PICTURE, textClassName)}>
              {lead}
              <FeaturedImage image={image} />
              {children}
            </div>
          ) : (
            <>
              {lead}
              {children}
            </>
          )}
        </DetailLayout>
      </div>
    </article>
  )
}
