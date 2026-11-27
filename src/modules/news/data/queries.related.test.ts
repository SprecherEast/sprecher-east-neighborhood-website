import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { bootPayload, NO_REVALIDATE, paragraph } from '@/platform/payload/testing/inMemoryPayload'

import type * as Queries from './queries'

/**
 * What the post page and the event page ask of the posts (#1496): the events a post picks, by id,
 * and the posts by id. Payload runs on in-memory SQLite.
 */

let payload: Payload
let queries: typeof Queries

const write = { overrideAccess: true, context: NO_REVALIDATE } as const

const createPost = (slug: string, data: Record<string, unknown> = {}) =>
  payload.create({
    collection: 'posts',
    data: {
      title: slug,
      slug,
      content: paragraph('News.'),
      publishedAt: '2027-01-01T12:00:00.000Z',
      _status: 'published',
      ...data,
    },
    ...write,
  })

let ids: Record<string, number>

beforeAll(async () => {
  ;({ payload } = await bootPayload())
  queries = await import('./queries')

  const walk = await payload.create({
    collection: 'events',
    data: { title: 'Walk', slug: 'walk', date: '2027-03-05T00:00:00.000Z', _status: 'published' },
    ...write,
  })
  const quiet = await payload.create({
    collection: 'events',
    data: { title: 'Quiet', slug: 'quiet', date: '2027-03-06T00:00:00.000Z', _status: 'draft' },
    ...write,
  })

  const a = await createPost('post-a')
  const b = await createPost('post-b')
  const draft = await createPost('post-draft', { _status: 'draft' })
  const picker = await createPost('post-picker', { relatedEvents: [walk.id] })
  ids = { a: a.id, b: b.id, draft: draft.id, picker: picker.id, walk: walk.id, quiet: quiet.id }
}, 60_000)

describe('the events a post picks', () => {
  it('are named on the post page by id', async () => {
    const post = await queries.getPostBySlug('post-picker', { draft: false })
    expect(post?.relatedEventIds).toEqual([ids.walk])
  })

  it('are none when the editor picked none', async () => {
    const post = await queries.getPostBySlug('post-a', { draft: false })
    expect(post?.relatedEventIds).toEqual([])
  })
})

describe('findPostsByIds', () => {
  it('lists the published posts in the order they were picked', async () => {
    const posts = await queries.findPostsByIds([ids.b, ids.a])
    expect(posts.map((p) => p.slug)).toEqual(['post-b', 'post-a'])
  })

  it('leaves out a draft post and an id that is no post, and answers at once for no picks', async () => {
    const posts = await queries.findPostsByIds([ids.draft, ids.a, 99999])
    expect(posts.map((p) => p.slug)).toEqual(['post-a'])
    expect(await queries.findPostsByIds([])).toEqual([])
  })
})
