// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, ...props }: ComponentProps<'a'>) => <a href={href} {...props} />,
}))

import type { ImageRef } from '@/platform/lib/content'

import { ImageCredit } from './ImageCredit'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const photo = {
  id: 1,
  alt: 'A bus',
  credit: 'Jane Doe',
  license: 'cc-by-sa',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bus.jpg',
} as ImageRef

describe('ImageCredit', () => {
  it('credits the author and the license, each linked', async () => {
    const { container } = render(<ImageCredit image={photo} />)

    expect(container.textContent).toBe(
      'Photo: Jane Doe, opens in a new tab, CC BY-SA 4.0, opens in a new tab',
    )
    expect(screen.getByRole('link', { name: /Jane Doe/ }).getAttribute('href')).toBe(
      photo.sourceUrl,
    )
    expect(screen.getByRole('link', { name: /CC BY-SA 4.0/ }).getAttribute('href')).toBe(
      photo.licenseUrl,
    )
    await expectAccessible(container)
  })

  it('is the shared caption, in its small size, and takes a class for placement', () => {
    const { container } = render(<ImageCredit image={photo} className="text-right" />)

    const credit = container.firstElementChild as HTMLElement
    expect(credit.tagName).toBe('P')
    expect(credit.className).toContain('text-xs')
    expect(credit.className).toContain('text-muted-foreground')
    expect(credit.className).toContain('text-right')
  })

  it('shows plain text when the item has no links', () => {
    const { container } = render(
      <ImageCredit image={{ ...photo, sourceUrl: null, licenseUrl: null }} />,
    )

    expect(container.textContent).toBe('Photo: Jane Doe, CC BY-SA')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('names no license for our own photo', () => {
    const { container } = render(<ImageCredit image={{ ...photo, license: 'own' }} />)

    expect(container.textContent).toBe('Photo: Jane Doe, opens in a new tab')
  })

  it('shows nothing without an image or a credit', () => {
    expect(render(<ImageCredit image={null} />).container.textContent).toBe('')
    expect(render(<ImageCredit image={{ ...photo, credit: ' ' }} />).container.textContent).toBe('')
  })
})
