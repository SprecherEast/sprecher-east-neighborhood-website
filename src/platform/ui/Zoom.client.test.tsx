// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from './testing/expectAccessible'
import { Zoom } from './Zoom.client'

afterEach(cleanup)

const setup = (props: Partial<React.ComponentProps<typeof Zoom>> = {}) =>
  render(
    <Zoom
      title="Milwaukee Street concept"
      large={<p>Large picture</p>}
      aside={<p>The key</p>}
      {...props}
    >
      <p>Small picture</p>
    </Zoom>,
  )
const enlarge = () => screen.getByRole('button', { name: 'Enlarge: Milwaukee Street concept' })

describe('Zoom', () => {
  it('shows the small view and a button named by the title, and not the key or the large view', () => {
    setup()

    expect(screen.getByText('Small picture')).toBeTruthy()
    expect(screen.queryByText('Large picture')).toBeNull()
    expect(screen.queryByText('The key')).toBeNull()
    expect(enlarge().textContent).toContain('Enlarge')
  })

  it('names the button for what it enlarges when given a kind', () => {
    setup({ kind: 'chart' })
    expect(
      screen.getByRole('button', { name: 'Enlarge chart: Milwaukee Street concept' }),
    ).toBeTruthy()
  })

  it('hides the button when scripting is off', () => {
    setup()
    expect(enlarge().className).toContain('hidden')
    expect(enlarge().className).toContain('scripted:inline-flex')
  })

  it("draws an icon-only control over the picture's top-right corner when asked (#1156)", async () => {
    setup({ trigger: 'icon' })
    const button = enlarge()

    expect(button.textContent?.trim()).toBe('')
    expect(button.querySelector('svg')).toBeTruthy()
    expect(button.className).toContain('absolute')
    expect(button.className).toContain('right-2')
    expect(button.className).toContain('top-2')
    expect(button.className).toContain('size-11')
    expect(button.className).toContain('scripted:inline-flex')

    await userEvent.click(button)
    expect(within(screen.getByRole('dialog')).getByText('Large picture')).toBeTruthy()
  })

  it('keeps the text button by default, for charts (#1156)', () => {
    setup()
    expect(enlarge().className).not.toContain('absolute')
  })

  it('opens a dialog with the large view and the key, keeping the small view in the page', async () => {
    setup()
    await userEvent.click(enlarge())

    const dialog = screen.getByRole('dialog', { name: 'Milwaukee Street concept' })
    expect(within(dialog).getByText('Large picture')).toBeTruthy()
    expect(within(dialog).getByText('The key')).toBeTruthy()
    expect(screen.getByText('Small picture')).toBeTruthy()
  })

  it('moves the small view into the dialog when no large view is given, so it is never drawn twice', async () => {
    render(
      <Zoom title="A chart">
        <p id="one">Drawing</p>
      </Zoom>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enlarge: A chart' }))

    expect(document.querySelectorAll('#one')).toHaveLength(1)
    expect(within(screen.getByRole('dialog')).getByText('Drawing')).toBeTruthy()
  })

  it('opens from a click on the picture, but not when the reader was selecting text', async () => {
    setup()
    const small = screen.getByText('Small picture')

    const selection = window.getSelection()
    if (!selection) throw new Error('No selection API')
    const range = document.createRange()
    range.selectNodeContents(small)
    selection.removeAllRanges()
    selection.addRange(range)
    fireEvent.click(small)
    expect(screen.queryByRole('dialog')).toBeNull()

    selection.removeAllRanges()
    fireEvent.click(small)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('only opens from the clicks that match the pointer selector when one is given', () => {
    render(
      <Zoom title="T" pointerSelector="[data-drawing]">
        <p>Caption</p>
        <div data-drawing>
          <span>Drawing</span>
        </div>
      </Zoom>,
    )
    fireEvent.click(screen.getByText('Caption'))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByText('Drawing'))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes with Escape and gives focus back to the button', async () => {
    setup()
    await userEvent.click(enlarge())
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(enlarge())
  })

  it('lays the large view and the key side by side from lg, stacked below it', async () => {
    setup()
    await userEvent.click(enlarge())

    const grid = screen.getByText('Large picture').closest('div')?.parentElement
    if (!grid) throw new Error('No grid')
    expect(grid.className).toContain('lg:grid-cols-')
    expect(grid.children).toHaveLength(2)
  })

  it('has no accessibility violations, closed and open', async () => {
    const { container } = setup()
    await expectAccessible(container)
    await userEvent.click(enlarge())
    await expectAccessible(document.body)
  })
})
