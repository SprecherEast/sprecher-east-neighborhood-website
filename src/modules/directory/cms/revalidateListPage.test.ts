import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn(), expireCacheTag: vi.fn() }))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/platform/payload/expireCacheTag', () => ({ expireCacheTag: mocks.expireCacheTag }))

import { revalidateListPage } from './revalidateListPage'

const args = (context = {}) =>
  ({ doc: { id: 1 }, req: { payload: { logger: { info: vi.fn() } }, context } }) as never

beforeEach(() => vi.clearAllMocks())

describe('revalidateListPage', () => {
  it('refreshes the FAQ page and its tag after a save', () => {
    revalidateListPage('faq').afterChange(args())

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/faq')
    expect(mocks.expireCacheTag).toHaveBeenCalledWith('faq')
  })

  it('refreshes every resources group page, since a resource shows on one of them', () => {
    revalidateListPage('resources').afterChange(args())

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/resources/[group]', 'page')
    expect(mocks.expireCacheTag).toHaveBeenCalledWith('resources')
  })

  it('refreshes after a delete too', () => {
    revalidateListPage('resources').afterDelete(args())

    expect(mocks.revalidatePath).toHaveBeenCalledWith('/resources/[group]', 'page')
  })

  it('does nothing when the save says not to (the seed)', () => {
    revalidateListPage('resources').afterChange(args({ disableRevalidate: true }))

    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.expireCacheTag).not.toHaveBeenCalled()
  })
})
