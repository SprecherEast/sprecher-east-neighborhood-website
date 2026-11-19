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
type DocWithMeta = Partial<Pick<Page | Post | Event, 'meta' | 'slug'>>

export const generateMeta = async (args: { doc: DocWithMeta | null }): Promise<Metadata> => {
  const { doc } = args

  const meta = doc?.meta

  const ogImage = getImageURL(meta?.image)

  const title = meta?.title || 'Sprecher East'

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
    title,
  }
}
