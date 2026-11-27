import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const next = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: next.revalidatePath }))

import { revalidateLinkedPages } from './revalidateLinked'

beforeEach(() => next.revalidatePath.mockReset())

const payloadFinding = (docs: { slug?: string | null }[]) => {
  const find = vi.fn().mockResolvedValue({ docs })
  const error = vi.fn()
  return { payload: { find, logger: { error } } as unknown as Payload, find, error }
}

describe('revalidateLinkedPages', () => {
  it('refreshes the page of each linked document, with only its slug read', async () => {
    const { payload, find } = payloadFinding([{ slug: 'walk' }, { slug: null }, { slug: 'fair' }])

    await revalidateLinkedPages({
      payload,
      collection: 'events',
      where: { id: { in: [1, 2, 3] } },
      basePath: '/events',
    })

    expect(next.revalidatePath.mock.calls).toEqual([['/events/walk'], ['/events/fair']])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'events',
        where: { id: { in: [1, 2, 3] } },
        select: { slug: true },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      }),
    )
  })

  it('logs a failed lookup and never throws, so a save is not undone by a refresh', async () => {
    const { payload, find, error } = payloadFinding([])
    find.mockRejectedValue(new Error('database busy'))

    await expect(
      revalidateLinkedPages({
        payload,
        collection: 'posts',
        where: { id: { equals: 1 } },
        basePath: '/posts',
      }),
    ).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledTimes(1)
  })
})
