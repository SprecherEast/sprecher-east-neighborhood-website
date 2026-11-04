// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { FIXTURES } from '@/platform/lib/chart/fixtures'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { Chart } from './Chart'

afterEach(cleanup)

const SPEC = FIXTURES.bars
const ENLARGE = `Enlarge chart: ${SPEC.title}`

/** Every element of the page, whatever Radix has hidden from assistive technology */
const all = (selector: string) => [...document.querySelectorAll(selector)]

function ids() {
  return all('[id]').map((element) => element.id)
}

async function openByButton() {
  await userEvent.click(screen.getByRole('button', { name: ENLARGE }))
  return screen.getByRole('dialog', { name: SPEC.title })
}

describe('ChartZoom, through Chart (#681)', () => {
  it('puts a visible Enlarge button beside the chart, named by the chart’s title', () => {
    render(<Chart spec={SPEC} />)
    const button = screen.getByRole('button', { name: ENLARGE })

    expect(button.textContent).toContain('Enlarge')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // 44 px on a phone (WCAG 2.5.8): the kit's sm button
    expect(button.className).toContain('min-h-11')
    // With scripting off the button does nothing, so it is hidden then
    expect(button.className).toContain('hidden')
    expect(button.className).toContain('scripted:inline-flex')
  })

  it('opens the chart in a modal dialog named by its title, with focus inside', async () => {
    render(<Chart spec={SPEC} />)
    const dialog = await openByButton()

    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(within(dialog).getByRole('img', { name: new RegExp(SPEC.title) })).toBeTruthy()
    expect(within(dialog).getByText(SPEC.summary)).toBeTruthy()
  })

  it('opens from the keyboard with Enter and with Space', async () => {
    render(<Chart spec={SPEC} />)
    screen.getByRole('button', { name: ENLARGE }).focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: SPEC.title })).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()

    screen.getByRole('button', { name: ENLARGE }).focus()
    await userEvent.keyboard(' ')
    expect(screen.getByRole('dialog', { name: SPEC.title })).toBeTruthy()
  })

  it('opens when the drawing itself is clicked or tapped', async () => {
    render(<Chart spec={SPEC} />)
    await userEvent.click(screen.getByRole('img', { name: new RegExp(SPEC.title) }))
    expect(screen.getByRole('dialog', { name: SPEC.title })).toBeTruthy()
  })

  it('closes with Escape and with the close button, and focus goes back to Enlarge', async () => {
    render(<Chart spec={SPEC} />)
    await openByButton()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: ENLARGE }))

    await openByButton()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: ENLARGE }))
  })

  it('keeps the chart in the page once at any moment: one drawing, one table, unique ids', async () => {
    render(<Chart spec={SPEC} />)
    const count = () => ({
      figures: all('figure').filter((figure) => figure.querySelector('[role="img"]')).length,
      drawings: all('[role="img"]').length,
      tables: all('table').length,
      titles: all('p').filter((p) => p.textContent === SPEC.title).length,
    })
    const closed = count()
    expect(closed).toEqual({ figures: 1, drawings: 1, tables: 1, titles: 1 })
    expect(new Set(ids()).size).toBe(ids().length)

    await openByButton()
    expect(count()).toEqual(closed)
    expect(new Set(ids()).size).toBe(ids().length)

    await userEvent.keyboard('{Escape}')
    expect(count()).toEqual(closed)
  })

  it('has the numbers under "Show the numbers" in both sizes', async () => {
    render(<Chart spec={SPEC} />)
    expect(screen.getByText('Show the numbers')).toBeTruthy()

    const dialog = await openByButton()
    expect(within(dialog).getByText('Show the numbers')).toBeTruthy()
    expect(within(dialog).getByRole('table', { hidden: true })).toBeTruthy()
  })

  it('draws the dialog’s chart at the large width and stacked, the page’s at the small one', async () => {
    const { container } = render(<Chart spec={SPEC} />)
    expect(container.innerHTML).toContain('[--chart-width:var(--chart-small-width)]')
    expect(container.innerHTML).not.toContain('chart-large-width')

    const dialog = await openByButton()
    expect(dialog.innerHTML).toContain('[--chart-width:var(--chart-large-width)]')
    // The side-by-side thumbnail layout is the page's; the dialog stacks
    expect(dialog.innerHTML).not.toContain('grid-cols-[var(--chart-small-width)')
  })

  it('draws no raster picture in either size: text and shapes only', async () => {
    const { container } = render(<Chart spec={SPEC} />)
    const raster = (root: ParentNode) =>
      root.querySelectorAll('img, canvas, picture, [class*="bg-[url"], [style*="background-image"]')

    expect(raster(container)).toHaveLength(0)
    const dialog = await openByButton()
    expect(raster(dialog)).toHaveLength(0)
    expect(dialog.querySelector('svg[role="img"]')).toBeTruthy()
    expect(within(dialog).getAllByText('$477.5M', { exact: false }).length).toBeGreaterThan(0)
  })

  it('leaves a box of the chart’s height in the page, so the page does not jump', async () => {
    const { container } = render(<Chart spec={SPEC} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('min-h-[var(--chart-zoom-height,0px)]')

    await openByButton()
    expect(root.style.getPropertyValue('--chart-zoom-height')).toMatch(/px$/)
    await userEvent.keyboard('{Escape}')
    expect(root.style.getPropertyValue('--chart-zoom-height')).toBe('')
  })

  it('passes axe closed and open', async () => {
    const { container } = render(<Chart spec={SPEC} />)
    await expectAccessible(container)
    await openByButton()
    await expectAccessible(document.body)
  })

  it.each([
    ['units', FIXTURES.paysFor],
    ['stacked', FIXTURES.operating],
  ])('works for a %s chart too', async (_kind, spec) => {
    render(<Chart spec={spec} />)
    await userEvent.click(screen.getByRole('button', { name: `Enlarge chart: ${spec.title}` }))
    const dialog = screen.getByRole('dialog', { name: spec.title })
    expect(within(dialog).getByRole('img', { name: new RegExp(spec.title) })).toBeTruthy()
    expect(all('[role="img"]')).toHaveLength(1)
  })
})
