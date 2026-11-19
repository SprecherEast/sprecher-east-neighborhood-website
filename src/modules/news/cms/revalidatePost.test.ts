import { existsSync } from 'node:fs'
import path from 'node:path'

import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Post } from '@/payload-types'

const next = vi.hoisted(() => ({ revalidatePath: vi.fn(), expireCacheTag: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: next.revalidatePath }))
vi.mock('@/platform/payload/expireCacheTag', () => ({ expireCacheTag: next.expireCacheTag }))

import { revalidateDelete, revalidatePost } from './revalidatePost'

beforeEach(() => {
  next.revalidatePath.mockReset()
  next.expireCacheTag.mockReset()
})

const req = (context: Record<string, unknown> = {}) =>
  ({ payload: { logger: { info: vi.fn() } }, context }) as unknown as PayloadRequest

const post = (slug: string, status: Post['_status']) => ({ slug, _status: status }) as Post

const afterChange = (doc: Post, previousDoc: Post, context?: Record<string, unknown>) =>
  revalidatePost({
    doc,
    previousDoc,
    req: req(context),
    collection: {} as never,
    context: {},
    data: {},
    operation: 'update',
  })

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
