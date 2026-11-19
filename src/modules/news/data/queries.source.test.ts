import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, NO_REVALIDATE, paragraph } from '@/platform/payload/testing/inMemoryPayload'

import type * as Queries from './queries'

/**
 * A published post's source (#483) reaches the post page, the news listing and the related posts
 * it links to, as stored. Payload runs on in-memory SQLite.
 */

let payload: Payload
let queries: typeof Queries

const legistar = 'https://madison.legistar.com/Calendar.aspx'

const createPost = (slug: string, data: Record<string, unknown> = {}) =>
  payload.create({
    collection: 'posts',
    data: {
      title: slug,
      slug,
      content: paragraph('News.'),
      publishedAt: '2026-10-01T12:00:00.000Z',
      _status: 'published',
      ...data,
    },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('./queries')

  const sourced = await createPost('council-recap', {
    sourceName: 'City of Madison',
    sourceUrl: legistar,
  })
  const own = await createPost('own-news')
  // Related posts are set after creating: their filter leaves out the post's own id
  await payload.update({
    collection: 'posts',
    id: own.id,
    data: { relatedPosts: [sourced.id] },
    overrideAccess: true,
    context: NO_REVALIDATE,
  })
}, 60_000)

const expected = { name: 'City of Madison', url: legistar }

describe('the post source in queries (#483)', () => {
  it('reaches the post page', async () => {
    const post = await queries.getPostBySlug('council-recap', { draft: false })
    expect(post?.source).toEqual(expected)
  })

  it('reaches the cards of the news listing, and only the post that has one', async () => {
    const { docs } = await queries.findPostPage(1)
    const sources = Object.fromEntries(docs.map((doc) => [doc.slug, doc.source]))
    expect(sources).toEqual({ 'council-recap': expected, 'own-news': null })
  })

  it('reaches the latest posts an archive block lists', async () => {
    const docs = await queries.findLatestPosts({ limit: 5 })
    expect(docs.find((doc) => doc.slug === 'council-recap')?.source).toEqual(expected)
  })

  it('reaches a related post’s card, loaded through the posts’ default fields', async () => {
    const post = await queries.getPostBySlug('own-news', { draft: false })
    expect(post?.relatedPosts.map((related) => related.source)).toEqual([expected])
  })
})
