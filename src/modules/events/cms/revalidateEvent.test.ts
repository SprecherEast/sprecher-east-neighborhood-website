import { existsSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/platform/payload/expireCacheTag', () => ({ expireCacheTag: vi.fn() }))

const linked = vi.hoisted(() => ({ revalidateLinkedPages: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/platform/payload/revalidateLinked', () => ({
  revalidateLinkedPages: linked.revalidateLinkedPages,
}))

import { revalidateDelete, revalidateEvent } from './revalidateEvent'

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
