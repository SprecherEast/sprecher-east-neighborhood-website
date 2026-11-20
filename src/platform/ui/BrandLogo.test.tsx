// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BrandLogo } from './BrandLogo'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('BrandLogo', () => {
  it('draws Google’s own “G” file as it is, at its own proportions (#1365)', () => {
    const { container } = render(<BrandLogo brand="google" />)
    const image = container.querySelector('img')

    // Unoptimized: the file is served as Google supplies it, never re-encoded or recoloured
    expect(image?.getAttribute('src')).toBe('/brand/google-g.png')
    expect(image?.getAttribute('width')).toBe('200')
    expect(image?.getAttribute('height')).toBe('204')
    expect(image?.className).toContain('w-auto')
  })

  it('draws the FIDO passkey icon file as supplied, square, no larger than the “G” (#1365)', () => {
    const { container } = render(<BrandLogo brand="passkey" />)
    const image = container.querySelector('img')

    expect(image?.getAttribute('src')).toBe('/brand/fido-passkey-icon.png')
    // The file's own 150 by 150 proportions, kept by height with the width following
    expect(image?.getAttribute('width')).toBe('150')
    expect(image?.getAttribute('height')).toBe('150')
    expect(image?.className).toContain('h-5')
    expect(image?.className).toContain('w-auto')
    expect(image?.className).not.toMatch(/\b(rounded|object-cover|object-fill|scale|rotate)/)
  })

  it('is decoration: the button’s words name it, so it has no name of its own', async () => {
    const { container } = render(
      <button type="button">
        <BrandLogo brand="google" />
        Continue with Google
      </button>,
    )

    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
    await expectAccessible(container)
  })

  it('keeps the passkey icon decorative too, named by “Log in with a passkey”', async () => {
    const { container } = render(
      <button type="button">
        <BrandLogo brand="passkey" />
        Log in with a passkey
      </button>,
    )

    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
    await expectAccessible(container)
  })

  it('never takes a colour, filter or stroke, which brand rules forbid', () => {
    for (const brand of ['google', 'passkey'] as const) {
      const { container } = render(<BrandLogo brand={brand} />)
      const classes = container.querySelector('img')?.className ?? ''

      expect(classes).not.toMatch(
        /\b(text|fill|stroke|grayscale|opacity|brightness|invert|filter|shadow|ring|border)-/,
      )
    }
  })
})
