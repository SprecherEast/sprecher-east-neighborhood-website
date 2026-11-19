// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { ChartZoom } from './ChartZoom.client'

afterEach(cleanup)

/** A stand-in for the server-rendered chart: a drawing, text and one table, with ids of its own */
function Drawing() {
  return (
    <figure>
      <p id="t">Where the money goes</p>
      <div data-chart-drawing>
        <svg role="img" aria-labelledby="t" viewBox="0 0 10 10">
          <text>Safety</text>
        </svg>
      </div>
      <table>
        <caption>The numbers</caption>
        <tbody>
          <tr>
            <td>Safety</td>
          </tr>
        </tbody>
      </table>
    </figure>
  )
}

const setup = () =>
  render(
    <ChartZoom title="Where the money goes">
      <Drawing />
    </ChartZoom>,
  )
const enlarge = () => screen.getByRole('button', { name: 'Enlarge chart: Where the money goes' })

/** Every id on the page appears once, so a chart drawn twice would fail here */
const duplicateIds = () => {
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
  return ids.filter((id, index) => ids.indexOf(id) !== index)
}

describe('ChartZoom', () => {
  it('shows the chart and a visible "Enlarge" button named by the chart’s title', () => {
    setup()
    expect(enlarge().textContent).toContain('Enlarge')
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hides the button when scripting is off and keeps it a touch target otherwise', () => {
    setup()
    const classes = enlarge().className
    expect(classes).toContain('hidden')
    expect(classes).toContain('scripted:inline-flex')
    expect(classes).toContain('min-h-11')
  })

  it('opens a dialog named by the chart’s title with the chart inside, once on the page', async () => {
    setup()
    await userEvent.click(enlarge())

    const dialog = screen.getByRole('dialog', { name: 'Where the money goes' })
    expect(within(dialog).getByRole('img')).toBeTruthy()
    expect(dialog.contains(document.activeElement)).toBe(true)
    // One drawing, one table and no repeated id, even with the dialog open
    expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(1)
    expect(document.querySelectorAll('table')).toHaveLength(1)
    expect(duplicateIds()).toEqual([])
  })

  it('leaves an empty, hidden box where the chart was while the dialog is open', async () => {
    const { container } = setup()
    await userEvent.click(enlarge())

    const holder = container.querySelector('[data-zoom-holder]') as HTMLElement
    expect(holder.querySelector('svg[role="img"]')).toBeNull()
    expect(holder.getAttribute('aria-hidden')).toBe('true')
  })

  it.each([['{Enter}'], [' ']])('opens with the keyboard (%j)', async (key) => {
    setup()
    await userEvent.tab()
    expect(document.activeElement).toBe(enlarge())
    await userEvent.keyboard(key)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('opens when the drawing itself is clicked', async () => {
    const { container } = setup()
    await userEvent.click(container.querySelector('[data-chart-drawing] text') as Element)
    expect(screen.getByRole('dialog', { name: 'Where the money goes' })).toBeTruthy()
  })

  it('does not open when a reader has just selected the drawing’s text (#681)', () => {
    const { container } = setup()
    const text = container.querySelector('[data-chart-drawing] text') as Element
    const range = document.createRange()
    range.selectNodeContents(text)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    // A drag-select ends in a click with the selection in place (user-event's click would collapse it)
    fireEvent.click(text)
    expect(screen.queryByRole('dialog')).toBeNull()

    window.getSelection()?.removeAllRanges()
    fireEvent.click(text)
    expect(screen.getByRole('dialog', { name: 'Where the money goes' })).toBeTruthy()
  })

  it('does not open from a click on text outside the drawing', async () => {
    setup()
    await userEvent.click(screen.getByText('Where the money goes'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes on Escape and on the close button, and focus returns to the Enlarge button', async () => {
    setup()
    await userEvent.click(enlarge())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(enlarge())
    expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(1)

    await userEvent.click(enlarge())
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(enlarge())
  })

  it('traps focus inside the dialog', async () => {
    setup()
    await userEvent.click(enlarge())
    const dialog = screen.getByRole('dialog')
    for (let press = 0; press < 4; press++) {
      await userEvent.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('passes axe, closed and open', async () => {
    const { container } = setup()
    await expectAccessible(container)
    await userEvent.click(enlarge())
    await expectAccessible(document.body)
  })
})
