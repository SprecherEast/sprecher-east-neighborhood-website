// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Navigation from 'next/navigation'

import { NOT_INDEXED } from '@/platform/seo/notIndexed'

import { GALLERY_COMPONENTS } from './galleryComponents'
import GalleryPage, { metadata } from './page'

// Next's notFound() ends the render with a 404; the test only checks it is called
const { notFound } = vi.hoisted(() => ({ notFound: vi.fn() }))
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  notFound,
}))
// Vitest loads an image import as its path; Next gives its size too
vi.mock('@/endpoints/seed/image-hero1.webp', () => ({
  default: { src: '/sample.webp', width: 1600, height: 900 },
}))

beforeEach(() => {
  notFound.mockClear()
  // jsdom has no ResizeObserver, which Radix Checkbox uses inside a form
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(cleanup)

// The one test that renders the whole gallery (every shared component, in jsdom) takes 2 to 6 s
// alone, depending on machine load, so it can pass or fail against the 5 s default (#1146). Only
// this test gets the longer limit; the default is not raised for the rest.
const RENDER_WHOLE_GALLERY_TIMEOUT = 30_000

describe('/dev/gallery (#466)', () => {
  it.each(['production', 'test'])('is a 404 when NODE_ENV is %s', (env) => {
    vi.stubEnv('NODE_ENV', env)
    GalleryPage()
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('asks search engines not to index it', () => {
    expect(metadata.robots).toEqual(NOT_INDEXED)
  })

  it(
    'shows a heading for every component under next dev',
    () => {
      vi.stubEnv('NODE_ENV', 'development')
      render(GalleryPage())

      expect(notFound).not.toHaveBeenCalled()
      // One role query for every level-2 heading. A role-and-name query per component walks the
      // whole gallery each time (44 walks, about half the test's time, which timed out on CI, #1146)
      const headings = screen.getAllByRole('heading', { level: 2 })
      for (const name of GALLERY_COMPONENTS) {
        // an entry's heading is plain text, so its name is its text; exactly one heading per name
        const matches = headings.filter((heading) => heading.textContent?.trim() === name)
        expect(matches, `heading "${name}"`).toHaveLength(1)
        expect(matches[0]?.id).toBe(`gallery-${name.toLowerCase()}`)
      }
    },
    RENDER_WHOLE_GALLERY_TIMEOUT,
  )
})
