import { existsSync } from 'node:fs'
import path from 'node:path'

import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as RevalidateLinked from '@/platform/payload/revalidateLinked'

import type { Post } from '@/payload-types'

const next = vi.hoisted(() => ({ revalidatePath: vi.fn(), expireCacheTag: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: next.revalidatePath }))
vi.mock('@/platform/payload/expireCacheTag', () => ({ expireCacheTag: next.expireCacheTag }))

const linked = vi.hoisted(() => ({
  revalidateLinkedPages: vi.fn().mockResolvedValue(undefined),
  findLinkedSlugs: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/platform/payload/revalidateLinked', async (importOriginal) => ({
  ...(await importOriginal<typeof RevalidateLinked>()),
  revalidateLinkedPages: linked.revalidateLinkedPages,
  findLinkedSlugs: linked.findLinkedSlugs,
}))

import { readEventsBeforeDelete, revalidateDelete, revalidatePost } from './revalidatePost'

beforeEach(() => {
  next.revalidatePath.mockReset()
  next.expireCacheTag.mockReset()
  linked.revalidateLinkedPages.mockClear()
})

const req = (context: Record<string, unknown> = {}) =>
  ({ payload: { logger: { info: vi.fn() } }, context }) as unknown as PayloadRequest

const post = (slug: string, status: Post['_status']) => ({ slug, _status: status }) as Post

const afterChange = async (doc: Post, previousDoc: Post, context?: Record<string, unknown>) =>
  revalidatePost({
    doc,
    previousDoc,
    req: req(context),
    collection: {} as never,
    context: {},
    data: {},
    operation: 'update',
  })

const withEvents = (doc: Post, relatedEvents: Post['relatedEvents']) =>
  ({ ...doc, relatedEvents }) as Post

const paths = () => next.revalidatePath.mock.calls.map(([pathname]) => pathname as string)

describe('revalidatePost', () => {
  // A post renamed or moved shows its new title and slug in "top issues" on any CMS page (#484)
  it('refreshes the home page and every CMS page, which may link to the post', () => {
    afterChange(post('new-name', 'published'), post('old-name', 'published'))

    expect(next.revalidatePath).toHaveBeenCalledWith('/')
    expect(next.revalidatePath).toHaveBeenCalledWith('/(frontend)/[slug]', 'page')
    expect(paths()).toContain('/posts/new-name')
  })

  it('refreshes only route patterns that exist under src/app', () => {
    afterChange(post('potluck', 'published'), post('potluck', 'draft'))

    const patterns = next.revalidatePath.mock.calls.filter(([, type]) => type === 'page')
    expect(patterns).not.toHaveLength(0)
    for (const [pattern] of patterns) {
      const file = path.join(process.cwd(), 'src/app', pattern, 'page.tsx')
      expect(existsSync(file), `${pattern} has no page.tsx`).toBe(true)
    }
  })

  it('refreshes the pages showing a post taken back to draft', () => {
    afterChange(post('potluck', 'draft'), post('potluck', 'published'))

    expect(paths()).toEqual(expect.arrayContaining(['/posts/potluck', '/', '/(frontend)/[slug]']))
  })

  it('leaves a draft that was never published alone, and the seed’s saves', () => {
    afterChange(post('potluck', 'draft'), post('potluck', 'draft'))
    afterChange(post('potluck', 'published'), post('potluck', 'draft'), { disableRevalidate: true })

    expect(next.revalidatePath).not.toHaveBeenCalled()
  })
})

// A post lists the events it is about, and each event's page lists the post (#1496)
describe('revalidatePost, linked events', () => {
  it('refreshes the pages of the events it links now and the ones it linked before', async () => {
    await afterChange(
      withEvents(post('walk-recap', 'published'), [5, 7]),
      withEvents(post('walk-recap', 'published'), [7, 6]),
    )

    expect(linked.revalidateLinkedPages).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'events',
        where: { id: { in: [5, 7, 6] } },
        basePath: '/events',
      }),
    )
  })

  it('refreshes them when the post is taken back to draft, which drops it from their pages', async () => {
    await afterChange(
      withEvents(post('walk-recap', 'draft'), [5]),
      withEvents(post('walk-recap', 'published'), [5]),
    )

    expect(linked.revalidateLinkedPages).toHaveBeenCalledTimes(1)
  })

  it('looks nothing up for a post that links no event, a draft never published, or a seed save', async () => {
    await afterChange(post('plain', 'published'), post('plain', 'published'))
    await afterChange(withEvents(post('d', 'draft'), [5]), withEvents(post('d', 'draft'), [5]))
    await afterChange(withEvents(post('s', 'published'), [5]), withEvents(post('s', 'draft'), []), {
      disableRevalidate: true,
    })

    expect(linked.revalidateLinkedPages).not.toHaveBeenCalled()
  })
})

describe('revalidateDelete', () => {
  it('refreshes every CMS page when a post is deleted', () => {
    revalidateDelete({
      doc: post('potluck', 'published'),
      id: 1,
      req: req(),
      collection: {} as never,
      context: {},
    })

    expect(next.revalidatePath).toHaveBeenCalledWith('/(frontend)/[slug]', 'page')
    expect(next.expireCacheTag).toHaveBeenCalledWith('posts-sitemap')
  })
})

// A deleted post no longer shows on the events it picked, so their pages are refreshed. The events
// are read before the delete, since the rows that link them are gone afterward (#1496)
describe('revalidatePost, deleting a post that picks events', () => {
  const findByID = vi.fn()
  const logger = { error: vi.fn(), info: vi.fn() }
  let context: Record<string, unknown> = {}
  const before = (ctx: Record<string, unknown>) =>
    readEventsBeforeDelete({
      id: 4,
      req: { payload: { findByID, logger }, context: ctx },
    } as unknown as Parameters<typeof readEventsBeforeDelete>[0])
  const after = (ctx: Record<string, unknown>) =>
    revalidateDelete({ doc: post('walk-recap', 'published'), req: { context: ctx } } as Parameters<
      typeof revalidateDelete
    >[0])

  beforeEach(() => {
    findByID.mockReset().mockResolvedValue({ relatedEvents: [5, { id: 7 }] })
    linked.findLinkedSlugs.mockReset().mockResolvedValue(['walk', 'fair'])
    logger.error.mockReset()
    context = {}
  })

  it('reads the events it picks before, and refreshes their pages after', async () => {
    await before(context)
    after(context)

    expect(linked.findLinkedSlugs).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'events',
        where: { id: { in: [5, 7] } },
        basePath: '/events',
      }),
    )
    expect(paths()).toEqual(
      expect.arrayContaining(['/posts/walk-recap', '/events/walk', '/events/fair']),
    )
  })

  it('looks nothing up for a post that picks no event, and nothing for a seed delete', async () => {
    findByID.mockResolvedValue({ relatedEvents: [] })
    await before(context)
    after(context)
    expect(linked.findLinkedSlugs).not.toHaveBeenCalled()
    expect(paths()).toEqual(expect.not.arrayContaining(['/events/walk']))

    next.revalidatePath.mockReset()
    const seed = { disableRevalidate: true }
    await before(seed)
    after(seed)
    expect(findByID).toHaveBeenCalledTimes(1)
    expect(next.revalidatePath).not.toHaveBeenCalled()
  })

  it('logs a failed read and still refreshes the post’s own pages', async () => {
    findByID.mockRejectedValue(new Error('database busy'))
    await expect(before(context)).resolves.toBeUndefined()
    after(context)

    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(paths()).toContain('/posts/walk-recap')
  })
})
