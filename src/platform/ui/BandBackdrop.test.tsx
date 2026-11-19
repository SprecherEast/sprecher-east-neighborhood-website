// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImageRef } from '@/platform/lib'
import { BAND_PHOTO_ALPHA, BAND_SCRIM_ALPHA } from '@/platform/theme/tokens'

import { BandBackdrop } from './BandBackdrop'
import { expectAccessible } from './testing/expectAccessible'

// next/image's props are what matter here: draw a plain img that shows them
vi.mock('next/image', () => ({
  default: ({
    alt,
    className,
    quality,
    priority,
    style,
    sizes,
  }: {
    alt: string
    className?: string
    quality?: number
    priority?: boolean
    style?: React.CSSProperties
    sizes?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element -- a test double for next/image
    <img
      alt={alt}
      className={className}
      data-quality={quality}
      data-priority={String(!!priority)}
      data-position={style?.objectPosition}
      data-sizes={sizes}
    />
  ),
}))

afterEach(cleanup)

const photo = (id: number, extra: Partial<ImageRef> = {}) =>
  ({
    id,
    alt: `Alt ${id}`,
    url: `/api/media/file/${id}.jpg`,
    width: 1920,
    height: 640,
    mimeType: 'image/jpeg',
    updatedAt: '2026-11-11T00:00:00.000Z',
    createdAt: '2026-11-11T00:00:00.000Z',
    ...extra,
  }) as ImageRef

const none = { phone: null, tablet: null, desktop: null }

describe('BandBackdrop', () => {
  it('draws nothing without a photo, which leaves the plain band', () => {
    const { container } = render(<BandBackdrop backdrop={null} />)
    expect(container.firstChild).toBeNull()

    const empty = render(<BandBackdrop backdrop={none} />)
    expect(empty.container.firstChild).toBeNull()
  })

  it('is decoration: hidden from assistive tech, with an empty alt whatever the upload says', () => {
    const { container } = render(<BandBackdrop backdrop={{ ...none, desktop: photo(1) }} />)
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
    const img = container.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('')
  })

  it('draws one image per different crop and shows each at its own screen size', () => {
    const { container } = render(
      <BandBackdrop backdrop={{ phone: photo(1), tablet: photo(2), desktop: photo(3) }} />,
    )
    expect(container.querySelectorAll('img')).toHaveLength(3)
    const shown = Array.from(container.querySelectorAll('[data-backdrop-size]')).map((el) => [
      el.getAttribute('data-backdrop-size'),
      el.className,
    ])
    expect(shown).toEqual([
      ['phone', expect.stringContaining('md:hidden')],
      ['tablet', expect.stringContaining('max-md:hidden')],
      ['desktop', expect.stringContaining('max-lg:hidden')],
    ])
  })

  it('draws a photo once when it serves every size, and always shows it', () => {
    const one = photo(1)
    const { container } = render(
      <BandBackdrop backdrop={{ phone: one, tablet: one, desktop: one }} />,
    )
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('[data-backdrop-size]')?.className).not.toMatch(/hidden/)
  })

  it('crops around each upload’s focal point', () => {
    const { container } = render(
      <BandBackdrop backdrop={{ ...none, desktop: photo(1, { focalX: 20, focalY: 70 }) }} />,
    )
    expect(container.querySelector('img')?.getAttribute('data-position')).toBe('20% 70%')
  })

  it('is sized for the band: a light file at the width of the screen, loaded like any image', () => {
    const { container } = render(<BandBackdrop backdrop={{ ...none, desktop: photo(1) }} />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('data-quality')).toBe('50')
    expect(img?.getAttribute('data-sizes')).toBe('100vw')
    // Not the page's largest picture, so it never takes the early-load slot from the article's own
    expect(img?.getAttribute('data-priority')).toBe('false')
  })

  it('fades the photo and washes it with a theme scrim, at the strengths the theme test checks', () => {
    const { container } = render(<BandBackdrop backdrop={{ ...none, desktop: photo(1) }} />)
    const html = container.innerHTML
    expect(html).toContain(`opacity-${BAND_PHOTO_ALPHA * 100}`)
    expect(html).toContain(`bg-surface/${BAND_SCRIM_ALPHA * 100}`)
    expect(html).toContain('grayscale')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<BandBackdrop backdrop={{ ...none, desktop: photo(1) }} />)
    await expectAccessible(container)
  })
})
