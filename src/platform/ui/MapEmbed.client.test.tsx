// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { MapEmbed } from './MapEmbed.client'
import { EXPAND_ICON_BUTTON } from './layoutSizes'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const EMBED = 'https://www.google.com/maps/d/embed?mid=1AbC_dEf'

function renderMap(embedUrl: string | null = EMBED) {
  return render(
    <MapEmbed
      embedUrl={embedUrl}
      title="Where Sprecher East is"
      actionLabel="View the larger map"
      preview={<span role="img" aria-label="Map of Sprecher East" />}
    >
      <p>Our boundary, with I-94 to the north.</p>
    </MapEmbed>,
  )
}

describe('MapEmbed (#764)', () => {
  it('draws the preview and its text without contacting Google', async () => {
    const { container } = renderMap()

    expect(screen.getByText('Our boundary, with I-94 to the north.')).toBeTruthy()
    expect(container.querySelector('iframe')).toBeNull()
    await expectAccessible(container)
  })

  it('opens the live map in a named dialog when the preview is tapped', async () => {
    renderMap()
    await userEvent.click(screen.getAllByRole('button', { name: 'View the larger map' })[0])

    const dialog = screen.getByRole('dialog', { name: 'Where Sprecher East is' })
    const frame = dialog.querySelector('iframe')
    expect(frame?.getAttribute('src')).toBe(EMBED)
    // The frame carries its name (axe's frame-title rule); jsdom can't run axe across a frame
    expect(frame?.getAttribute('title')).toBe('Where Sprecher East is')

    // axe can't look across a frame in jsdom, so it checks the open dialog without it
    frame?.remove()
    await expectAccessible(dialog)
  })

  it("puts the expand icon over the picture's top-right corner, a control of its own (#1426)", async () => {
    renderMap()
    const [pictureButton, icon] = screen.getAllByRole('button', { name: 'View the larger map' })

    // The same look as Zoom's icon: one shared definition, always visible, 44 px
    expect(icon.className).toContain(EXPAND_ICON_BUTTON)
    expect(icon.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // Beside the picture button, never inside it (no button in a button), both in the picture's box
    expect(pictureButton.contains(icon)).toBe(false)
    expect(icon.parentElement).toBe(pictureButton.parentElement)

    await userEvent.click(icon)
    expect(screen.getByRole('dialog', { name: 'Where Sprecher East is' })).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    expect(document.activeElement).toBe(icon)
  })

  it('opens from the text button too, and closes on Escape with focus back on it', async () => {
    renderMap()
    const buttons = screen.getAllByRole('button', { name: 'View the larger map' })
    const textButton = buttons[buttons.length - 1]
    await userEvent.click(textButton)
    expect(screen.getByRole('dialog')).toBeTruthy()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(textButton)
  })

  it('stacks the picture, then the text, and takes the width it is given', () => {
    const { container } = renderMap()
    const root = container.firstElementChild as HTMLElement
    const picture = screen.getByRole('img', { name: 'Map of Sprecher East' })
    const text = screen.getByText('Our boundary, with I-94 to the north.')

    // Its own width decides the layout (a container), and it sets no width or place of its own:
    // the section that holds it does
    expect(root.className).toContain('@container')
    expect(root.className).not.toMatch(/justify-self|(^|\s)w-\d/)
    expect(picture.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('puts the text on the left, 5 of 8 columns, and the picture on the right, 3 of 8, once it is wide (#1419)', () => {
    const { container } = renderMap()
    const grid = container.querySelector('.\\@3xl\\:grid-cols-8') as HTMLElement
    const [picture, text] = Array.from(grid.children) as HTMLElement[]

    expect(grid.className).toContain('@3xl:items-center')
    expect(picture.className).toContain('@3xl:col-span-3')
    expect(picture.className).toContain('@3xl:order-2')
    expect(text.className).toContain('@3xl:col-span-5')
    expect(text.className).toContain('@3xl:order-1')
    expect(picture.contains(screen.getByRole('img', { name: 'Map of Sprecher East' }))).toBe(true)
    expect(text.textContent).toContain('Our boundary, with I-94 to the north.')
  })

  it('limits what the frame may do', async () => {
    renderMap()
    await userEvent.click(screen.getAllByRole('button', { name: 'View the larger map' })[0])

    const frame = screen.getByRole('dialog').querySelector('iframe')
    expect(frame?.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
    )
    expect(frame?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
  })

  it.each([
    ['no address', null],
    ['an address that is not a Google map embed', 'https://example.com/maps/embed?pb=1'],
  ])('shows the preview and text only, with %s', async (_name, embedUrl) => {
    const { container } = renderMap(embedUrl)

    expect(screen.queryByRole('button')).toBeNull() // no picture button, icon or text button
    expect(screen.getByRole('img', { name: 'Map of Sprecher East' })).toBeTruthy()
    expect(container.querySelector('iframe')).toBeNull()
    await expectAccessible(container)
  })
})
