import { existsSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as RevalidateLinked from '@/platform/payload/revalidateLinked'

const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/platform/payload/expireCacheTag', () => ({ expireCacheTag: vi.fn() }))

const linked = vi.hoisted(() => ({
  revalidateLinkedPages: vi.fn().mockResolvedValue(undefined),
  findLinkedSlugs: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/platform/payload/revalidateLinked', async (importOriginal) => ({
  ...(await importOriginal<typeof RevalidateLinked>()),
  revalidateLinkedPages: linked.revalidateLinkedPages,
  findLinkedSlugs: linked.findLinkedSlugs,
}))

import { readPostsBeforeDelete, revalidateDelete, revalidateEvent } from './revalidateEvent'

/**
 * A route pattern passed to `revalidatePath(…, 'page')` names a folder under `src/app`. If the
 * route moves or a group is renamed, Next refreshes nothing and says nothing, so each pattern must
 * still point at a real page (#122).
 */
function deleteEvent() {
  revalidatePath.mockClear()
  revalidateDelete({ doc: { slug: 'potluck' }, req: { context: {} } } as unknown as Parameters<
    typeof revalidateDelete
  >[0])
}

describe('revalidateEvent', () => {
  it('refreshes only route patterns that exist under src/app', () => {
    deleteEvent()

    const patterns = revalidatePath.mock.calls
      .filter(([, type]) => type === 'page')
      .map(([pattern]) => pattern as string)
    expect(patterns.length).toBeGreaterThan(0)
    for (const pattern of patterns) {
      const file = path.join(process.cwd(), 'src/app', pattern.slice(1), 'page.tsx')
      expect(existsSync(file), `${pattern} has no page.tsx`).toBe(true)
    }
  })

  // The "this week" strip (#122) sits on CMS pages, the home page included
  it('refreshes the home page and every CMS page, which may hold the "this week" strip', () => {
    deleteEvent()

    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(revalidatePath).toHaveBeenCalledWith('/(frontend)/[slug]', 'page')
    expect(existsSync(path.join(process.cwd(), 'src/app/(frontend)/page.tsx'))).toBe(true)
  })
})

// Posts that pick an event show it, so a save or an unpublish refreshes their pages (#1496)
describe('revalidateEvent, linked posts', () => {
  const save = (id: number, status: string, previous: string, context = {}) =>
    revalidateEvent({
      doc: { id, slug: 'walk', _status: status },
      previousDoc: { id, slug: 'walk', _status: previous },
      req: { payload: { logger: { info: vi.fn() } }, context },
    } as unknown as Parameters<typeof revalidateEvent>[0])

  beforeEach(() => linked.revalidateLinkedPages.mockClear())

  it('refreshes the pages of the published posts that pick the event', async () => {
    await save(9, 'published', 'draft')

    expect(linked.revalidateLinkedPages).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        where: { and: [{ _status: { equals: 'published' } }, { relatedEvents: { equals: 9 } }] },
        basePath: '/posts',
      }),
    )
  })

  it('does it when a published event is taken back to draft', async () => {
    await save(9, 'draft', 'published')
    expect(linked.revalidateLinkedPages).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a draft never published, or a seed save', async () => {
    await save(9, 'draft', 'draft')
    await save(9, 'published', 'draft', { disableRevalidate: true })
    expect(linked.revalidateLinkedPages).not.toHaveBeenCalled()
  })
})

// A deleted event no longer shows on the posts that picked it, so their pages are refreshed. The
// posts are read before the delete, since the rows that link them are gone afterward (#1496)
describe('revalidateEvent, deleting an event that posts pick', () => {
  let context: Record<string, unknown> = {}
  const before = (ctx: Record<string, unknown>) =>
    readPostsBeforeDelete({
      id: 9,
      req: { payload: {}, context: ctx },
    } as unknown as Parameters<typeof readPostsBeforeDelete>[0])
  const after = (ctx: Record<string, unknown>) =>
    revalidateDelete({ doc: { slug: 'walk' }, req: { context: ctx } } as unknown as Parameters<
      typeof revalidateDelete
    >[0])

  beforeEach(() => {
    revalidatePath.mockClear()
    linked.findLinkedSlugs.mockReset().mockResolvedValue(['recap', 'fair-recap'])
    context = {}
  })

  it('reads the published posts that pick it before, and refreshes their pages after', async () => {
    await before(context)
    after(context)

    expect(linked.findLinkedSlugs).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'posts',
        where: { and: [{ _status: { equals: 'published' } }, { relatedEvents: { equals: 9 } }] },
      }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/events/walk')
    expect(revalidatePath).toHaveBeenCalledWith('/posts/recap')
    expect(revalidatePath).toHaveBeenCalledWith('/posts/fair-recap')
  })

  it('refreshes only its own pages when no post was read, and nothing for a seed delete', async () => {
    after(context)
    expect(revalidatePath).not.toHaveBeenCalledWith('/posts/recap')

    revalidatePath.mockClear()
    const seed = { disableRevalidate: true }
    await before(seed)
    after(seed)
    expect(linked.findLinkedSlugs).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
