// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IMAGE_QUALITIES } from '@/imageQualities'
import type { BackdropCrops, ImageRef } from '@/platform/lib'
import { BACKDROP_SCRIM_ALPHA } from '@/platform/theme/tokens'

import { PageBackdrop } from './PageBackdrop'
import { expectAccessible } from './testing/expectAccessible'
import { stubMatchMedia } from './testing/stubMatchMedia'

// The image's quality and priority are props of next/image, and the allowed qualities are applied
// by next.config.js, which Vitest doesn't load: draw a plain img that shows the props it got
vi.mock('next/image', () => ({
  default: ({
    alt,
    className,
    quality,
    priority,
    src,
  }: {
    alt: string
    className?: string
    quality?: number
    priority?: boolean
    src: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element -- a test double for next/image
    <img
      alt={alt}
      className={className}
      src={src}
      data-quality={quality}
      data-priority={String(!!priority)}
    />
  ),
}))

afterEach(cleanup)

beforeEach(() => stubMatchMedia())

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

const other = { ...image, id: 2, url: '/api/media/file/tablet.jpg' } as ImageRef
const wide = { ...image, id: 3, url: '/api/media/file/desktop.jpg' } as ImageRef
const one: BackdropCrops = { phone: image, tablet: image, desktop: image }

const renderBackdrop = (backdrop: BackdropCrops | null = one) =>
  render(
    <PageBackdrop backdrop={backdrop}>
      <p>Content</p>
    </PageBackdrop>,
  )

describe('PageBackdrop', () => {
  it('draws only its content when the page has no photo', () => {
    const { container } = renderBackdrop(null)

    expect(screen.getByText('Content')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
    expect(container.firstElementChild?.tagName).toBe('P')
  })

  it('draws only its content when every crop is empty', () => {
    const { container } = renderBackdrop({ phone: null, tablet: null, desktop: null })

    expect(container.querySelector('img')).toBeNull()
    expect(container.firstElementChild?.tagName).toBe('P')
  })

  // The page's text blocks and the title read `data-backdrop` to sit solid on the photo (#1268)
  it('marks the page as having a backdrop, for the text plates and the title glow', () => {
    const { container } = renderBackdrop()

    expect(container.firstElementChild?.hasAttribute('data-backdrop')).toBe(true)
    // Not a stacking context, so the photo goes under the site footer too, which lies outside it
    expect(container.firstElementChild?.className).not.toMatch(/\b(isolate|relative)\b/)
  })

  // A decoration: hidden from assistive tech, with an empty alt, whatever the media's own alt says
  it('draws the photo as a hidden decoration behind the whole page', async () => {
    const { container } = renderBackdrop()

    const photo = container.querySelector('img')
    expect(photo?.getAttribute('alt')).toBe('')
    const layer = photo?.closest('[aria-hidden="true"]')
    expect(layer).toBeTruthy()
    expect(layer?.className).toContain('pointer-events-none')
    expect(layer?.className).toContain('-z-10')
    // Fixed to the screen, so it runs behind the page from top to bottom whatever its length
    expect(layer?.className).toContain('fixed')
    expect(layer?.className).toContain('inset-0')
    await expectAccessible(container)
  })

  it('keeps the photo in full colour: not grayed and not faded', () => {
    const { container } = renderBackdrop()

    const classes = container.querySelector('img')?.className ?? ''
    expect(classes).not.toContain('grayscale')
    expect(classes).not.toMatch(/opacity-/)
    expect(container.innerHTML).not.toContain('from-background')
  })

  // The scrim is the theme's own colour at a faint strength, the same for every photo (rule 14)
  it('lays the theme background over the photo, faint, from the theme tokens', () => {
    const { container } = renderBackdrop()

    const scrim = container.querySelector('[aria-hidden="true"] > [class*="bg-background"]')
    expect(scrim).toBeTruthy()
    expect(BACKDROP_SCRIM_ALPHA).toEqual({ light: 0.08, dark: 0.14 })
    expect(scrim?.className).toContain(
      `bg-background/${Math.round(BACKDROP_SCRIM_ALPHA.light * 100)}`,
    )
    expect(scrim?.className).toContain(
      `dark:bg-background/${Math.round(BACKDROP_SCRIM_ALPHA.dark * 100)}`,
    )
  })

  // The owner's ask (#777): darker gray text in the light theme, brighter in the dark one. The two
  // text tokens are re-pointed inside the backdrop only
  it('makes muted and primary text stronger over the photo, in either theme', () => {
    const { container } = renderBackdrop()

    const classes = container.firstElementChild?.className ?? ''
    expect(classes).toContain(
      '[--muted-foreground:color-mix(in_srgb,var(--foreground)_80%,var(--background))]',
    )
    expect(classes).toContain('[--primary:var(--primary-strong)]')
  })

  it('asks for a lighter encode of the photo', () => {
    const { container } = renderBackdrop()

    expect(container.querySelector('img')?.getAttribute('data-quality')).toBe(
      String(IMAGE_QUALITIES.backdrop),
    )
  })

  // Several different crops: only the one for the screen's size should ever be fetched
  it('draws a photo once, and loads it at once, when every size uses it', () => {
    const { container } = renderBackdrop()

    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('img')?.getAttribute('data-priority')).toBe('true')
  })

  it('draws one box per crop, shown at its own sizes, and loads none of them early', () => {
    const { container } = renderBackdrop({ phone: image, tablet: other, desktop: wide })

    const boxes = [...container.querySelectorAll('[data-backdrop-size]')]
    expect(boxes.map((box) => box.getAttribute('data-backdrop-size'))).toEqual([
      'phone',
      'tablet',
      'desktop',
    ])
    expect(boxes[0].className).toContain('md:hidden')
    expect(boxes[1].className).toContain('max-md:hidden')
    expect(boxes[2].className).toContain('max-lg:hidden')
    // A hidden image that were eager would be fetched too: only the screen's own crop is
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('data-priority')).toBe('false')
    }
  })

  it('lets a size with no crop use the nearest one', () => {
    const { container } = renderBackdrop({ phone: null, tablet: null, desktop: wide })

    const boxes = container.querySelectorAll('[data-backdrop-size]')
    expect(boxes).toHaveLength(1)
    expect(boxes[0].getAttribute('data-backdrop-size')).toBe('phone tablet desktop')
  })

  // The crop of each size is where its photo's good part is: a focal point, not the centre
  it("crops each box around its upload's focal point", () => {
    const { container } = renderBackdrop()

    expect(container.querySelector('img')?.className).toContain('object-cover')
  })

  it('moves slowly with the scroll, without taking part in the layout', () => {
    const { container } = renderBackdrop()

    const mover = container.querySelector('[data-backdrop-parallax]') as HTMLElement
    expect(mover).toBeTruthy()
    // Out of the flow and taller than the screen, so it can drift without showing an edge
    expect(mover.className).toContain('absolute')
    expect(mover.className).toContain('will-change-transform')
  })

  it('leaves room at the foot of the page, where the photo shows before the footer', () => {
    const { container } = renderBackdrop()

    expect(container.firstElementChild?.className).toMatch(/\bpb-/)
  })
})
