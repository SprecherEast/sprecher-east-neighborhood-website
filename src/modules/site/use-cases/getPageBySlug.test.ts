import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock('../data/pages', () => ({ getPageBySlug: vi.fn() }))
// `cache` keeps one answer per request; here every call must reach the data
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  cache: <T>(fn: T) => fn,
}))

import * as pages from '../data/pages'
import { getPageBySlug } from './getPageBySlug'

const stored = vi.mocked(pages.getPageBySlug)
const photo = { id: 7, url: '/api/media/file/dusk.jpg', alt: 'Dusk', width: 1920, height: 983 }
const page = { id: 1, slug: 'get-involved', hero: { type: 'none' }, layout: [] }

beforeEach(() => vi.clearAllMocks())

describe('getPageBySlug', () => {
  // #777: the stored upload becomes the plain image the page draws behind its content
  it('gives the page’s backdrop photo as an image', async () => {
    stored.mockResolvedValue({ ...page, backdrop: photo } as never)

    expect((await getPageBySlug('get-involved'))?.backdrop).toEqual(photo)
  })

  it('gives none when the page has no photo, or only its id (not loaded)', async () => {
    stored.mockResolvedValue({ ...page, backdrop: null } as never)
    expect((await getPageBySlug('get-involved'))?.backdrop).toBeNull()

    stored.mockResolvedValue({ ...page, backdrop: 7 } as never)
    expect((await getPageBySlug('get-involved'))?.backdrop).toBeNull()
  })

  it('gives no page when there is none', async () => {
    stored.mockResolvedValue(null)

    expect(await getPageBySlug('gone')).toBeNull()
  })
})
