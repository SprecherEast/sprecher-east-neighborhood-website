import type { Metadata } from 'next/types'

import React from 'react'

import { findPostPage, PostsFeed } from '@/modules/news/server'
import { PageHeader } from '@/platform/ui/PageHeader'
import { PAGE_SHELL } from '@/platform/ui/layoutSizes'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function Page() {
  // First page is rendered on the server; more posts load as the reader scrolls.
  const posts = await findPostPage(1)

  return (
    <div className={PAGE_SHELL}>
      <PageHeader eyebrow="News" title="News & Updates" />

      <PostsFeed initial={posts} />
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'News & Updates',
    description: 'Latest news and updates from the Sprecher East neighborhood.',
  }
}
