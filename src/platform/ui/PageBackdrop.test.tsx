// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImageRef } from '@/platform/lib'

import { PageBackdrop } from './PageBackdrop'
import { expectAccessible } from './testing/expectAccessible'

// The image's encode quality is a prop of next/image, and its allowed values live in next.config.js,
// which Vitest doesn't load: draw a plain img that shows the props it got
vi.mock('next/image', () => ({
  default: ({ alt, className, quality }: { alt: string; className?: string; quality?: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- a test double for next/image
    <img alt={alt} className={className} data-quality={quality} />
  ),
}))

afterEach(cleanup)

const image = {
  id: 1,
  alt: 'Rooftops and a green field at dusk',
  url: '/api/media/file/dusk.jpg',
  width: 1920,
  height: 983,
  mimeType: 'image/jpeg',
  updatedAt: '2026-11-06T00:00:00.000Z',
  createdAt: '2026-11-06T00:00:00.000Z',
} as ImageRef

describe('PageBackdrop', () => {
  it('draws only its content when the page has no photo', () => {
    const { container } = render(
      <PageBackdrop image={null}>
        <p>Content</p>
      </PageBackdrop>,
    )

    expect(screen.getByText('Content')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    expect(container.firstElementChild?.tagName).toBe('P')
  })

  // A decoration: hidden from assistive tech, with an empty alt, whatever the media's own alt says
  it('draws the photo as a hidden decoration behind the content', async () => {
    const { container } = render(
      <main>
        <PageBackdrop image={image}>
          <h1>Get involved</h1>
        </PageBackdrop>
      </main>,
    )

    const photo = container.querySelector('img')
    expect(photo?.getAttribute('alt')).toBe('')
    const layer = photo?.closest('[aria-hidden="true"]')
    expect(layer).toBeTruthy()
    expect(layer?.className).toContain('pointer-events-none')
    expect(layer?.className).toContain('-z-10')
    expect(screen.getByRole('heading', { name: 'Get involved' })).toBeTruthy()
    await expectAccessible(container)
  })

  // Legibility: the photo is grayed and faded, then washed into the theme's own background, so the
  // text keeps the contrast the theme was checked for in both modes
  it('grays and fades the photo into the theme background', () => {
    const { container } = render(
      <PageBackdrop image={image}>
        <p>Content</p>
      </PageBackdrop>,
    )

    expect(container.querySelector('img')?.className).toContain('grayscale')
    const wash = container.querySelector('[aria-hidden="true"] > [class*="from-background"]')
    expect(wash?.className).toContain('to-background')
  })

  // The owner's ask (#777): darker gray text in the light theme, brighter in the dark one. The two
  // text tokens are re-pointed inside the backdrop only: muted gray moves toward the main text
  // colour, and primary-coloured text (links, eyebrows) takes the stronger shade made for panels
  it('makes muted and primary text stronger over the photo, in either theme', () => {
    const { container } = render(
      <PageBackdrop image={image}>
        <p>Content</p>
      </PageBackdrop>,
    )

    const classes = container.firstElementChild?.className ?? ''
    expect(classes).toContain(
      '[--muted-foreground:color-mix(in_srgb,var(--foreground)_80%,var(--background))]',
    )
    expect(classes).toContain('[--primary:var(--primary-strong)]')
  })

  // A faint decoration doesn't need the full-quality encode every other photo gets
  it('asks for a lighter encode of the photo', () => {
    const { container } = render(
      <PageBackdrop image={image}>
        <p>Content</p>
      </PageBackdrop>,
    )

    expect(container.querySelector('img')?.getAttribute('data-quality')).toBe('50')
  })

  it('keeps the page content above the photo in its own stacking context', () => {
    const { container } = render(
      <PageBackdrop image={image}>
        <p>Content</p>
      </PageBackdrop>,
    )

    expect(container.firstElementChild?.className).toContain('isolate')
  })
})
