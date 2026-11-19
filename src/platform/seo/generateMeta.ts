import type { Metadata } from 'next'

import type { Media, Page, Post, Event, Config } from '@/payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { toAbsoluteURL } from '@/platform/lib/getURL'
import { documentHref } from '@/platform/payload/documentHref'

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  if (image && typeof image === 'object' && 'url' in image) {
    const url = image.sizes?.og?.url || image.url
    if (url) return toAbsoluteURL(url)
  }

  return toAbsoluteURL('/images/photo.jpeg')
}

/** What the metadata reads from a page, post or event; a page's layout may already be mapped */
type DocWithMeta = Partial<Pick<Page | Post | Event, 'meta' | 'slug' | 'title'>>

const SITE_NAME = 'Sprecher East'

export const generateMeta = async (args: { doc: DocWithMeta | null }): Promise<Metadata> => {
  const { doc } = args

  const meta = doc?.meta

  const ogImage = getImageURL(meta?.image)

  // The SEO title, else the document's own title. The layout's template adds the site name after
  // either; with neither, the name alone is the whole title, so it shows once, not twice.
  const ownTitle = meta?.title || doc?.title
  const title = ownTitle || SITE_NAME

  return {
    description: meta?.description,
    openGraph: mergeOpenGraph({
      description: meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: typeof doc?.slug === 'string' ? documentHref('pages', doc.slug) : '/',
    }),
    title: ownTitle || { absolute: SITE_NAME },
  }
}
