// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BrandLogo, LOGO_SLOT_HEIGHT } from './BrandLogo'
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
    expect(image?.className).toContain('h-5')
    expect(image?.className).toContain('w-auto')
  })

  it('draws the FIDO passkey tile file trimmed to its rounded corners, 32 px tall, while the “G” stays 20 px (#1372)', () => {
    const { container } = render(<BrandLogo brand="passkey" />)
    const image = container.querySelector('img')

    // The tile's own proportions (105 by 106, no white margin), kept by height with the width following
    expect(image?.getAttribute('src')).toBe('/brand/fido-passkey-icon-tile.png')
    expect(image?.getAttribute('width')).toBe('105')
    expect(image?.getAttribute('height')).toBe('106')
    expect(image?.className).toContain('h-8')
    expect(image?.className).toContain('w-auto')
    expect(image?.className).not.toMatch(/\b(rounded|object-cover|object-fill|scale|rotate)/)
  })

  it('seats both logos in one slot, so they sit the same distance from the button’s top and bottom (#1372)', () => {
    for (const brand of ['google', 'passkey'] as const) {
      const { container } = render(<BrandLogo brand={brand} />)
      const slot = container.firstElementChild

      expect(slot?.tagName).toBe('SPAN')
      expect(slot?.className).toContain(LOGO_SLOT_HEIGHT)
      expect(slot?.className).toContain('items-center')
      expect(slot?.querySelector('img')).not.toBeNull()
      cleanup()
    }
    expect(LOGO_SLOT_HEIGHT).toBe('h-8')
  })

  it('draws the tile’s file with transparent corners, so no white shows on a dark page (#1372)', async () => {
    const { readFile } = await import('node:fs/promises')
    const png = await readFile('public/brand/fido-passkey-icon-tile.png')

    // PNG header: width, height, bit depth 8, colour type 6 (RGBA)
    expect(png.readUInt32BE(16)).toBe(105)
    expect(png.readUInt32BE(20)).toBe(106)
    expect(png[25]).toBe(6)
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

  it('takes no class from a caller: a logo can’t be tinted or resized from outside', () => {
    const { container } = render(
      // @ts-expect-error: `className` is not a prop
      <BrandLogo brand="google" className="h-12 text-red-500" />,
    )
    const classes = container.querySelector('img')?.className ?? ''

    expect(classes).not.toContain('text-red-500')
    expect(classes).not.toContain('h-12')
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
