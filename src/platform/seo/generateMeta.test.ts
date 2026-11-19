import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Media } from '@/payload-types'

import { generateMeta } from './generateMeta'

const SITE = 'https://sprechereast.example'

const image = (url: string, ogUrl?: string): Media =>
  ({
    id: 1,
    alt: 'Park',
    url,
    sizes: ogUrl ? { og: { url: ogUrl } } : {},
    updatedAt: '',
    createdAt: '',
  }) satisfies Media

describe('generateMeta', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', SITE)
  })

  it('uses the SEO title and description, and the page address', async () => {
    const meta = await generateMeta({
      doc: { slug: 'about', meta: { title: 'About', description: 'Who we are' } },
    })

    expect(meta.title).toBe('About')
    expect(meta.description).toBe('Who we are')
    expect(meta.openGraph).toMatchObject({
      title: 'About',
      description: 'Who we are',
      url: '/about',
      siteName: 'Sprecher East',
    })
  })

  it('falls back to the document’s own title when it has no SEO title', async () => {
    const meta = await generateMeta({
      doc: { slug: 'park-cleanup', title: 'Park cleanup', meta: {} },
    })

    expect(meta.title).toBe('Park cleanup')
    expect(meta.openGraph).toMatchObject({ title: 'Park cleanup' })
  })

  it('prefers the SEO title over the document’s own title', async () => {
    const meta = await generateMeta({
      doc: { slug: 'a', title: 'Own title', meta: { title: 'SEO title' } },
    })

    expect(meta.title).toBe('SEO title')
  })

  it('shows the site name once when there is no title at all', async () => {
    const meta = await generateMeta({ doc: { slug: 'a', meta: {} } })

    // The layout's template would add the site name again, so the name is set as the whole title
    expect(meta.title).toEqual({ absolute: 'Sprecher East' })
    expect(meta.openGraph).toMatchObject({ title: 'Sprecher East' })
  })

  it('points the home page at the site root', async () => {
    const meta = await generateMeta({ doc: { slug: 'home', meta: {} } })

    expect(meta.openGraph).toMatchObject({ url: '/' })
  })

  it('falls back to the site name and the default photo', async () => {
    const meta = await generateMeta({ doc: null })

    expect(meta.title).toEqual({ absolute: 'Sprecher East' })
    expect(meta.openGraph).toMatchObject({
      url: '/',
      description: '',
      images: [{ url: `${SITE}/images/photo.jpeg` }],
    })
  })

  it('prefers the image’s social-card size, made absolute', async () => {
    const meta = await generateMeta({
      doc: {
        slug: 'a',
        meta: { image: image('/api/media/file/a.webp', '/api/media/file/a-og.webp') },
      },
    })

    expect(meta.openGraph).toMatchObject({ images: [{ url: `${SITE}/api/media/file/a-og.webp` }] })
  })

  it('uses the full image when it has no social-card size', async () => {
    const meta = await generateMeta({
      doc: { slug: 'a', meta: { image: image('/api/media/file/a.webp') } },
    })

    expect(meta.openGraph).toMatchObject({ images: [{ url: `${SITE}/api/media/file/a.webp` }] })
  })
})
