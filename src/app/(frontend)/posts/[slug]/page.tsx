import type { Metadata } from 'next'

import { draftMode } from 'next/headers'
import React from 'react'

import { ForumPrompt, getForumUrl, PayloadRedirects } from '@/modules/site/server'
import { articleColumnClass } from '@/platform/richtext/articleColumn'
import { articleToc } from '@/platform/richtext/articleToc'
import { RichText } from '@/platform/richtext/RichText'
import { richTextBlocks } from '@/platform/richtext/richTextBlocks'
import { ArticlePage } from '@/platform/ui/ArticlePage'
import { SidebarCTA } from '@/platform/ui/SidebarCTA'
import { findUpcomingEvents, SidebarEvents } from '@/modules/events/server'
import {
  findRecentPosts,
  getPostBySlug,
  listPostSlugs,
  postByline,
  postHeaderProps,
  postJsonLd,
  SidebarPosts,
} from '@/modules/news/server'
import { generateMeta } from '@/platform/seo/generateMeta'

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

  const textClassName = articleColumnClass(post.content)

  return (
    <ArticlePage
      className="pt-16 pb-16"
      jsonLd={postJsonLd(post)}
      // Allows redirects for valid pages too
      redirects={<PayloadRedirects disableNotFound url={url} />}
      draft={draft}
      image={post.heroImage}
      header={postHeaderProps(post)}
      byline={postByline(post)}
      textClassName={textClassName}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'News & Updates', href: '/posts' },
        { label: post.title },
      ]}
      toc={articleToc(post.content)}
      aside={
        <>
          <SidebarPosts posts={post.relatedPosts} title="Related Posts" />
          <SidebarPosts posts={recentPosts} title="You May Also Like" />
          <SidebarEvents events={upcomingEvents} title="Upcoming Events" />
          <SidebarCTA
            heading="Get Involved"
            description="Know something we’re missing? Please tell us."
            buttonLabel="Get Involved"
            buttonHref="/get-involved"
          />
        </>
      }
    >
      <RichText
        className={textClassName}
        data={post.content}
        blocks={richTextBlocks}
        enableGutter={false}
      />
      <ForumPrompt href={forumUrl} />
    </ArticlePage>
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
