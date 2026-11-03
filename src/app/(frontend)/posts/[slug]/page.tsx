import type { Metadata } from 'next'

import { draftMode } from 'next/headers'
import React from 'react'

import { Breadcrumbs } from '@/platform/ui/Breadcrumbs'
import { JsonLd } from '@/platform/ui/JsonLd'
import { LivePreviewListener } from '@/platform/ui/LivePreviewListener.client'
import { ForumPrompt, getForumUrl, PayloadRedirects } from '@/modules/site/server'
import { articleToc } from '@/platform/richtext/articleToc'
import { RichText } from '@/platform/richtext/RichText'
import { richTextBlocks } from '@/platform/richtext/richTextBlocks'
import { SidebarCTA } from '@/platform/ui/SidebarCTA'
import { findUpcomingEvents, SidebarEvents } from '@/modules/events/server'
import {
  findRecentPosts,
  getPostBySlug,
  listPostSlugs,
  postHeaderProps,
  postJsonLd,
  SidebarPosts,
} from '@/modules/news/server'
import { generateMeta } from '@/platform/seo/generateMeta'
import { DetailLayout } from '@/platform/ui/DetailLayout'
import { PageHeader } from '@/platform/ui/PageHeader'
import { cn } from '@/platform/lib/cn'

// A scheduled publish or unpublish runs outside a request, where Next can't refresh the cache, so
// the page also re-renders every 10 minutes (#141, decision 0011)
export const revalidate = 600

export async function generateStaticParams() {
  try {
    const posts = await listPostSlugs()
    return posts.map(({ slug }) => ({ slug }))
  } catch (error) {
    console.error('[posts] generateStaticParams failed; falling back to []', error)
    return []
  }
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Post({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/posts/' + decodedSlug
  const post = await getPostBySlug(decodedSlug)

  if (!post) return <PayloadRedirects url={url} />

  // News, events and the site's forum link meet here, not in either module (decision 0008)
  const [recentPosts, upcomingEvents, forumUrl] = await Promise.all([
    findRecentPosts(post),
    findUpcomingEvents(),
    getForumUrl(),
  ])

  return (
    // Without a photo the header is plain, so it keeps clear of the site header (#461)
    <article className={cn('pb-16', post.heroImage ? 'pt-16' : 'pt-32')}>
      <JsonLd data={postJsonLd(post)} />

      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <PageHeader {...postHeaderProps(post)} />

      <div className={cn(post.heroImage && 'pt-8')}>
        <div className="container">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'News & Updates', href: '/posts' },
              { label: post.title },
            ]}
          />
        </div>
        <DetailLayout
          toc={articleToc(post.content)}
          aside={
            <>
              <SidebarPosts posts={post.relatedPosts} title="Related Posts" />
              <SidebarPosts posts={recentPosts} title="You May Also Like" />
              <SidebarEvents events={upcomingEvents} title="Upcoming Events" />
              <SidebarCTA
                heading="Get Involved"
                description="Join your neighbors in building a stronger Sprecher East community."
                buttonLabel="Learn How"
                buttonHref="/get-involved"
              />
            </>
          }
        >
          <RichText
            className="max-w-[48rem]"
            data={post.content}
            blocks={richTextBlocks}
            enableGutter={false}
          />
          <ForumPrompt href={forumUrl} />
        </DetailLayout>
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  const post = await getPostBySlug(decodeURIComponent(slug))

  const meta = await generateMeta({ doc: post && { slug: post.slug, meta: post.meta } })
  if (!post) return meta

  return {
    ...meta,
    openGraph: {
      ...(meta.openGraph ?? {}),
      url: post.href,
    },
  }
}
