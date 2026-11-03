import type { Metadata } from 'next/types'

import { notFound } from 'next/navigation'
import React from 'react'

import { findPostPage, listPostPageNumbers, PostsFeed } from '@/modules/news/server'
import { parsePageNumber } from '@/platform/lib'
import { PageHeader } from '@/platform/ui/PageHeader'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

export const revalidate = 600

type Args = {
  params: Promise<{
    pageNumber: string
  }>
}

/**
 * Crawlable, no-JavaScript fallback for the news listing. /posts loads more posts as
 * you scroll; its "Load more" control links here when JavaScript is unavailable.
 */
export default async function Page({ params: paramsPromise }: Args) {
  const { pageNumber } = await paramsPromise
  const page = parsePageNumber(pageNumber)
  if (page === null) notFound()

  const posts = await findPostPage(page)
  if (page > 1 && page > posts.totalPages) notFound()

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        eyebrow={`News · Page ${page}`}
        title="News & Updates"
        backLink={{ href: '/posts', label: 'Back to the latest news' }}
      />

      <PostsFeed initial={posts} />
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  return {
    title: `News & Updates — Page ${pageNumber || ''}`,
  }
}

export async function generateStaticParams() {
  try {
    const pageNumbers = await listPostPageNumbers()
    return pageNumbers.map((pageNumber) => ({ pageNumber: String(pageNumber) }))
  } catch (error) {
    console.error('[posts/page] generateStaticParams failed; falling back to []', error)
    return []
  }
}
