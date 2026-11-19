import { getServerSideURL } from '@/platform/lib/getURL'

import type { PostDetail } from '../domain/types'

/**
 * Structured data for the post page (schema.org `Article`), for search engines. A post from an
 * outside source names the original it's based on (`isBasedOn`, #483).
 */
export function postJsonLd(post: PostDetail): Record<string, unknown> {
  const siteUrl = getServerSideURL()

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    url: `${siteUrl}${post.href}`,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    description: post.meta.description || '',
    author: {
      '@type': 'Organization',
      name: 'Sprecher East',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Sprecher East',
      url: siteUrl,
    },
    ...(post.source?.url ? { isBasedOn: post.source.url } : {}),
  }
}
