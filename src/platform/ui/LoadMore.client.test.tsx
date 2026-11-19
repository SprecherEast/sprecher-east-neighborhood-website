// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FeedMore, FeedPage } from '@/platform/lib'

import { useLoadMore } from './LoadMore.client'

afterEach(cleanup)

type Item = { id: number }

const firstPage = (nextCursor: string | null): FeedPage<Item> => ({
  docs: [{ id: 1 }, { id: 2 }],
  page: 3,
  totalPages: 5,
  totalDocs: 10,
  limit: 2,
  nextCursor,
})

describe('useLoadMore', () => {
  it('sends the cursor each load returned, not a page number (#125)', async () => {
    const load = vi
      .fn<(cursor: string) => Promise<FeedMore<Item>>>()
      .mockResolvedValueOnce({ docs: [{ id: 3 }], nextCursor: 'after-3', totalDocs: 9 })
      .mockResolvedValueOnce({ docs: [{ id: 4 }], nextCursor: null, totalDocs: 9 })
    const { result } = renderHook(() => useLoadMore(firstPage('after-2'), load))

    await act(() => result.current.loadMore())
    await act(() => result.current.loadMore())

    expect(load.mock.calls).toEqual([['after-2'], ['after-3']])
    expect(result.current.items.map((item) => item.id)).toEqual([1, 2, 3, 4])
    expect(result.current.totalDocs).toBe(9)
    expect(result.current.hasMore).toBe(false)
  })

  it('drops an item it already shows', async () => {
    const load = vi.fn(async () => ({
      docs: [{ id: 2 }, { id: 3 }],
      nextCursor: null,
      totalDocs: 3,
    }))
    const { result } = renderHook(() => useLoadMore(firstPage('after-2'), load))

    await act(() => result.current.loadMore())

    expect(result.current.items.map((item) => item.id)).toEqual([1, 2, 3])
  })

  it('links the numbered page after what is loaded, for readers without JavaScript', async () => {
    const load = vi.fn(async () => ({ docs: [{ id: 3 }], nextCursor: 'after-3', totalDocs: 10 }))
    const { result } = renderHook(() => useLoadMore(firstPage('after-2'), load))
    expect(result.current.nextPage).toBe(4)

    await act(() => result.current.loadMore())

    expect(result.current.nextPage).toBe(5)
  })

  it('loads nothing after the last page', async () => {
    const load = vi.fn<(cursor: string) => Promise<FeedMore<Item>>>()
    const { result } = renderHook(() => useLoadMore(firstPage(null), load))

    await act(() => result.current.loadMore())

    expect(result.current.hasMore).toBe(false)
    expect(load).not.toHaveBeenCalled()
  })
})
