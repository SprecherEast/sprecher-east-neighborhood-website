// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('FeaturedImage (#1013, #1023, #1055)', () => {
  it('shows the whole picture, never cropped, with its alt text and credit', async () => {
    const { container } = render(
      <main>
        <FeaturedImage image={picture} />
      </main>,
    )

    const img = screen.getByRole('img', { name: picture.alt ?? '' })
    // Its own proportions: no fixed box, no `object-fit`, no focal position
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

  it('is full width on a phone, half the column from a tablet, a third from the desktop', () => {
    const { container } = render(<FeaturedImage image={picture} />)
    const classes = (container.firstElementChild as HTMLElement).className.split(' ')

    expect(classes).toContain('w-full')
    expect(classes).toContain('md:w-1/2')
    expect(classes).toContain('lg:w-1/3')
    // To the right from a tablet up; below that it is a block above the text
    expect(classes).toContain('md:float-right')
    expect(classes).not.toContain('float-right')
    // The picture's top is the text's first line: no space above it
    expect(classes).toContain('mt-0')
    expect(classes).toContain('md:mt-0')
  })

  it('has no Enlarge button and opens no dialog: the picture is only shown (#1055)', async () => {
    const user = userEvent.setup()
    render(<FeaturedImage image={picture} />)

    expect(screen.queryByRole('button')).toBeNull()
    await user.click(screen.getByRole('img'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the credit under the picture', () => {
    const { container } = render(<FeaturedImage image={picture} />)

    expect(container.querySelector('figcaption')?.textContent).toContain('Jane Doe')
  })

  it('leaves no empty caption, and so no gap, for a picture with no credit', () => {
    const { container } = render(<FeaturedImage image={{ ...picture, credit: null }} />)

    expect(container.querySelector('figcaption')).toBeNull()
  })

  it('draws nothing, and leaves no gap, without a picture', () => {
    for (const image of [null, undefined]) {
      const { container } = render(<FeaturedImage image={image} />)
      expect(container.innerHTML).toBe('')
      cleanup()
    }
  })
})
