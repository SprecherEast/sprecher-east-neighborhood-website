import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PostDetail } from '../domain/types'
import { postJsonLd } from './postJsonLd'

const post: PostDetail = {
  id: 7,
  slug: 'road-study',
  href: '/posts/road-study',
  title: 'Road study hearings',
  publishedAt: '2026-10-01T12:00:00.000Z',
  categories: [],
  description: 'Public hearings.',
  image: null,
  source: null,
  heroImage: null,
  backdrop: null,
  content: {
    root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
  },
  authors: [],
  relatedPosts: [],
  createdAt: '2026-09-30T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
  meta: { title: null, description: 'Public hearings.', image: null },
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://sprechereast.example')
})

describe('postJsonLd', () => {
  it('describes the post as an Article by Sprecher East', () => {
    expect(postJsonLd(post)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Road study hearings',
      url: 'https://sprechereast.example/posts/road-study',
      datePublished: '2026-10-01T12:00:00.000Z',
      dateModified: '2026-10-02T12:00:00.000Z',
      description: 'Public hearings.',
      author: { '@type': 'Organization', name: 'Sprecher East' },
      publisher: {
        '@type': 'Organization',
        name: 'Sprecher East',
        url: 'https://sprechereast.example',
      },
    })
  })

  it('falls back to the creation date and an empty description', () => {
    const data = postJsonLd({
      ...post,
      publishedAt: null,
      meta: { ...post.meta, description: null },
    })
    expect(data).toMatchObject({ datePublished: '2026-09-30T12:00:00.000Z', description: '' })
  })

  it('names the original it is based on only when the source has a link (#483)', () => {
    const url = 'https://madison.legistar.com/Calendar.aspx'
    expect(postJsonLd({ ...post, source: { name: 'City of Madison', url } })).toMatchObject({
      isBasedOn: url,
    })
    expect(
      postJsonLd({ ...post, source: { name: 'City of Madison', url: null } }),
    ).not.toHaveProperty('isBasedOn')
    expect(postJsonLd(post)).not.toHaveProperty('isBasedOn')
  })
})
