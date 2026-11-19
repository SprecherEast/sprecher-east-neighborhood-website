// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Caption } from './Caption'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

describe('Caption', () => {
  it('is small, muted text in a paragraph by default', async () => {
    const { container } = render(<Caption>WisDOT concept, December 2024</Caption>)

    const caption = screen.getByText('WisDOT concept, December 2024')
    expect(caption.tagName).toBe('P')
    expect(caption.className).toContain('text-sm')
    expect(caption.className).toContain('text-muted-foreground')
    await expectAccessible(container)
  })

  it('is a figcaption inside a figure, and a div for block content like rich text', async () => {
    const { container } = render(
      <figure>
        <div role="img" aria-label="A map" />
        <Caption as="figcaption">Source: WisDOT</Caption>
      </figure>,
    )

    expect(screen.getByText('Source: WisDOT').tagName).toBe('FIGCAPTION')
    await expectAccessible(container)

    cleanup()
    render(
      <Caption as="div">
        <p>A paragraph</p>
      </Caption>,
    )
    expect(screen.getByText('A paragraph').parentElement?.tagName).toBe('DIV')
  })

  it('puts the fine print after the caption, in smaller type', async () => {
    const { container } = render(
      <Caption finePrint="Not final construction drawings; not to scale.">
        WisDOT preferred concept
      </Caption>,
    )

    const finePrint = screen.getByText('Not final construction drawings; not to scale.')
    expect(finePrint.tagName).toBe('SMALL')
    expect(finePrint.className).toContain('text-xs')
    expect(finePrint.className).toContain('block')
    expect(finePrint.parentElement?.textContent).toBe(
      'WisDOT preferred conceptNot final construction drawings; not to scale.',
    )
    await expectAccessible(container)
  })

  it('draws no fine print element without fine print', () => {
    const { container } = render(<Caption>Just a caption</Caption>)

    expect(container.querySelector('small')).toBeNull()
  })

  it('has a smaller size for credits that sit on their own', () => {
    render(<Caption size="sm">Photo: Jane Doe</Caption>)

    const caption = screen.getByText('Photo: Jane Doe')
    expect(caption.className).toContain('text-xs')
    expect(caption.className).not.toContain('text-sm')
    expect(caption.className).toContain('text-muted-foreground')
  })

  it('takes a class for placement, which wins over the defaults', () => {
    render(<Caption className="mt-3 text-right">Right-aligned</Caption>)

    expect(screen.getByText('Right-aligned').className).toContain('text-right')
  })
})
