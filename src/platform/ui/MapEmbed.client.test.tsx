// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { MapEmbed } from './MapEmbed.client'
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

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('img', { name: 'Map of Sprecher East' })).toBeTruthy()
    expect(container.querySelector('iframe')).toBeNull()
    await expectAccessible(container)
  })
})
