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

describe('/dev/gallery (#466)', () => {
  it.each(['production', 'test'])('is a 404 when NODE_ENV is %s', (env) => {
    vi.stubEnv('NODE_ENV', env)
    GalleryPage()
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('asks search engines not to index it', () => {
    expect(metadata.robots).toEqual(NOT_INDEXED)
  })

  it('shows a heading for every component under next dev', () => {
    vi.stubEnv('NODE_ENV', 'development')
    render(GalleryPage())

    expect(notFound).not.toHaveBeenCalled()
    for (const name of GALLERY_COMPONENTS) {
      const heading = screen.getByRole('heading', { level: 2, name })
      expect(heading.id).toBe(`gallery-${name.toLowerCase()}`)
    }
  })
})
