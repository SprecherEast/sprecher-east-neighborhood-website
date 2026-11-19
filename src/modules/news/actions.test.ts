import { describe, expect, it, vi } from 'vitest'

const findPostsAfter = vi.hoisted(() =>
  vi.fn(async () => ({ docs: [], nextCursor: null, totalDocs: 0 })),
)
vi.mock('./data/queries', () => ({ findPostsAfter }))

import { loadMorePosts } from './actions'

const CURSOR = '2026-10-19T14:30:00.000Z|42'

describe('loadMorePosts', () => {
  it('passes a valid cursor to the use case', async () => {
    await loadMorePosts(CURSOR)
    expect(findPostsAfter).toHaveBeenCalledWith({ key: '2026-10-19T14:30:00.000Z', id: 42 })
  })

  it.each([
    ['a page number instead of a cursor', 2],
    ['a bad date', 'not-a-date|1'],
    ['an extra field', `${CURSOR}|1`],
    ['a cursor that is too long', `${CURSOR}${'0'.repeat(64)}`],
    ['a Payload query', { publishedAt: { exists: true } }],
  ])('refuses %s without querying', async (_label, cursor) => {
    findPostsAfter.mockClear()
    await expect(loadMorePosts(cursor)).rejects.toThrow('Invalid request')
    expect(findPostsAfter).not.toHaveBeenCalled()
  })
})
