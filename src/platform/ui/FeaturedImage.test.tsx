// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ImageRef } from '@/platform/lib/content'

import { FeaturedImage } from './FeaturedImage'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const picture = {
  id: 1,
  alt: 'A poster with the details in a panel on its right',
  url: '/api/media/file/poster.webp',
  width: 1670,
  height: 941,
  mimeType: 'image/webp',
  credit: 'Jane Doe',
  updatedAt: '2026-10-01T12:00:00.000Z',
  createdAt: '2026-10-01T12:00:00.000Z',
} as ImageRef

describe('FeaturedImage (#1013)', () => {
  it('shows the whole picture, never cropped, with its alt text and credit', async () => {
    const { container } = render(
      <main>
        <FeaturedImage image={picture} />
      </main>,
    )

    const img = screen.getByRole('img', { name: picture.alt ?? '' })
    // Its own proportions at the column's width: no fixed box, no `object-fit`, no focal position
    expect(img.getAttribute('width')).toBe('1670')
    expect(img.getAttribute('height')).toBe('941')
    expect(img.className).toContain('h-auto')
    expect(img.className).toContain('w-full')
    expect(img.className).not.toContain('object-')
    expect(img.style.objectPosition).toBe('')
    expect(screen.getByText(/Jane Doe/)).toBeTruthy()
    await expectAccessible(container)
  })

  it('is the first visible image, so it loads early', () => {
    render(<FeaturedImage image={picture} />)

    expect(screen.getByRole('img').getAttribute('loading')).not.toBe('lazy')
  })

  it('stays within the reading width, from the column’s left edge', () => {
    const { container } = render(<FeaturedImage image={picture} />)

    expect(container.firstElementChild?.className).toContain('max-w-[var(--reading-width)]')
  })

  it('draws nothing, and leaves no gap, without a picture', () => {
    for (const image of [null, undefined]) {
      const { container } = render(<FeaturedImage image={image} />)
      expect(container.innerHTML).toBe('')
      cleanup()
    }
  })
})
