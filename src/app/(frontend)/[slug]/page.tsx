import type { Metadata } from 'next'

import { draftMode } from 'next/headers'
import React from 'react'
import { homeStatic } from '@/endpoints/seed/home-static'

import {
  getPageBySlug,
  listPageSlugs,
  PageHero,
  PayloadRedirects,
  RenderBlocks,
  toSiteHero,
} from '@/modules/site/server'
import { singleBackdrop } from '@/platform/lib'
import { generateMeta } from '@/platform/seo/generateMeta'
import { HOME_PAGE_SLUG } from '@/platform/payload/documentHref'
import { LivePreviewListener } from '@/platform/ui/LivePreviewListener.client'
import { PageBackdrop } from '@/platform/ui/PageBackdrop'
import { pageBlocks } from './pageBlocks'

// A scheduled publish or unpublish runs outside a request, where Next can't refresh the cache, so
// the page also re-renders every 10 minutes (#141, decision 0011)
export const revalidate = 600

export async function generateStaticParams() {
  try {
    const pages = await listPageSlugs()
    return pages.filter(({ slug }) => slug !== HOME_PAGE_SLUG).map(({ slug }) => ({ slug }))
  } catch (error) {
    console.error('[pages] generateStaticParams failed; falling back to []', error)
    return []
  }
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

// The text of a title-only hero, over the page's photo (#1268)
const LOW_HERO_ON_PHOTO = 'on-photo:[&_:is(h1,h2,h3,p,li)]:text-shadow-glow'

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = HOME_PAGE_SLUG } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/' + decodedSlug

  // Remove the fallback once your website is seeded. The starter home page has no blocks.
  const page =
    (await getPageBySlug(decodedSlug)) ??
    (slug === HOME_PAGE_SLUG
      ? { ...homeStatic, hero: toSiteHero(homeStatic.hero), layout: [], backdrop: null }
      : null)

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout, backdrop } = page

  return (
    <article className="pb-0">
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <PageBackdrop backdrop={singleBackdrop(backdrop)}>
        {/* A plain title and text on the page's photo keep the shared glow; a photo hero has its own
            photo and scrim */}
        {hero && (
          <div className={hero.variant === 'low' ? LOW_HERO_ON_PHOTO : undefined}>
            <PageHero {...hero} />
          </div>
        )}
        {/* A page's blocks are anything an editor builds, so the whole body sits solid on the
            photo and fades out at its foot, where the photo shows again (#1268) */}
        <div className="text-fade">
          <RenderBlocks blocks={layout} components={pageBlocks} />
        </div>
      </PageBackdrop>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = HOME_PAGE_SLUG } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const page = await getPageBySlug(decodedSlug)

  return generateMeta({ doc: page })
}
