import { existsSync } from 'node:fs'
import path from 'node:path'

import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Page } from '@/payload-types'

const next = vi.hoisted(() => ({ revalidatePath: vi.fn(), expireCacheTag: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: next.revalidatePath }))
vi.mock('@/platform/payload/expireCacheTag', () => ({ expireCacheTag: next.expireCacheTag }))

import { revalidateDelete, revalidatePage } from './revalidatePage'

beforeEach(() => {
  next.revalidatePath.mockReset()
  next.expireCacheTag.mockReset()
})

const req = (context: Record<string, unknown> = {}) =>
  ({ payload: { logger: { info: vi.fn() } }, context }) as unknown as PayloadRequest

const page = (slug: string, status: Page['_status']) => ({ slug, _status: status }) as Page

const afterChange = (doc: Page, previousDoc: Page, context?: Record<string, unknown>) =>
  revalidatePage({
    doc,
    previousDoc,
    req: req(context),
    collection: {} as never,
    context: {},
    data: {},
    operation: 'update',
  })

// Every CMS page and the home page, which may link to the saved page from a block (#484)
const LINKING_PAGES = [['/'], ['/(frontend)/[slug]', 'page']]

describe('revalidatePage', () => {
  it('refreshes a published page’s address, every page that may link to it, and the sitemap', () => {
    afterChange(page('about', 'published'), page('about', 'draft'))

    expect(next.revalidatePath.mock.calls).toEqual([['/about'], ...LINKING_PAGES])
    expect(next.expireCacheTag).toHaveBeenCalledExactlyOnceWith('pages-sitemap')
  })

  it('refreshes only route patterns that exist under src/app', () => {
    afterChange(page('about', 'published'), page('about', 'draft'))

    const patterns = next.revalidatePath.mock.calls.filter(([, type]) => type === 'page')
    expect(patterns).not.toHaveLength(0)
    for (const [pattern] of patterns) {
      const file = path.join(process.cwd(), 'src/app', pattern, 'page.tsx')
      expect(existsSync(file), `${pattern} has no page.tsx`).toBe(true)
    }
  })

  it('refreshes the home page at the site root', () => {
    afterChange(page('home', 'published'), page('home', 'published'))

    expect(next.revalidatePath).toHaveBeenCalledWith('/')
  })

  it('refreshes the old address when a published page goes back to draft', () => {
    afterChange(page('new', 'draft'), page('old', 'published'))

    expect(next.revalidatePath.mock.calls).toEqual([['/old'], ...LINKING_PAGES])
    expect(next.expireCacheTag).toHaveBeenCalledExactlyOnceWith('pages-sitemap')
  })

  it('leaves a draft that was never published alone', () => {
    afterChange(page('about', 'draft'), page('about', 'draft'))

    expect(next.revalidatePath).not.toHaveBeenCalled()
    expect(next.expireCacheTag).not.toHaveBeenCalled()
  })

  it('does nothing when the save asks not to revalidate (the seed)', () => {
    afterChange(page('about', 'published'), page('about', 'draft'), { disableRevalidate: true })

    expect(next.revalidatePath).not.toHaveBeenCalled()
    expect(next.expireCacheTag).not.toHaveBeenCalled()
  })
})

describe('revalidateDelete', () => {
  it('refreshes a deleted page’s address and the pages sitemap', () => {
    revalidateDelete({
      doc: page('about', 'published'),
      id: 1,
      req: req(),
      collection: {} as never,
      context: {},
    })

    expect(next.revalidatePath.mock.calls).toEqual([['/about'], ...LINKING_PAGES])
    expect(next.expireCacheTag).toHaveBeenCalledExactlyOnceWith('pages-sitemap')
  })
})
