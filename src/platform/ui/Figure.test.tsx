// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { Figure } from './Figure'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const STATIC_IMAGE = { src: '/map.png', width: 640, height: 480 }
const ITEMS = [
  { label: 'Milwaukee Street', text: 'The new ramp would start here.' },
  { label: 'Stoughton Road', text: null },
]

const setup = (props: Partial<React.ComponentProps<typeof Figure>> = {}) =>
  render(
    <Figure
      src={STATIC_IMAGE}
      alt="Concept map of the ramp"
      title="Concept for Milwaukee Street"
      label="Figure 2-9"
      caption="WisDOT's preferred concept."
      items={ITEMS}
      {...props}
    />,
  )

describe('Figure', () => {
  it('shows the label in a neutral badge and the short caption, and no key', () => {
    const { container } = setup()

    expect(screen.getByText('Figure 2-9').className).toContain('bg-muted')
    expect(screen.getByText("WisDOT's preferred concept.")).toBeTruthy()
    expect(screen.queryByText('The new ramp would start here.')).toBeNull()
    expect(container.querySelector('figure')).toBeTruthy()
  })

  it('floats right from md at 2/5 by default and stacks below', () => {
    const { container } = setup()
    const classes = (container.firstElementChild as HTMLElement).className

    expect(classes).toContain('md:float-right')
    expect(classes).toContain('md:w-2/5')
    expect(classes).not.toMatch(/(^| )float-right/)
  })

  it('takes its width from size', () => {
    const { container } = setup({ size: 'half' })
    expect((container.firstElementChild as HTMLElement).className).toContain('md:w-1/2')
  })

  it('floats at half the column on a tablet and a third from lg when asked (#1023)', () => {
    const { container } = setup({ size: 'half-then-third' })
    const classes = (container.firstElementChild as HTMLElement).className

    expect(classes).toContain('md:w-1/2')
    expect(classes).toContain('lg:w-1/3')
  })

  it('draws the picture and its caption with no Enlarge button or dialog when zoom is off (#1055)', async () => {
    setup({ zoom: false, caption: 'The ramp.' })

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('The ramp.')).toBeTruthy()
    await userEvent.click(screen.getByRole('img'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers the enlarge control as a small icon over the picture, not a text button (#1156)', () => {
    setup()
    const button = screen.getByRole('button', { name: 'Enlarge: Concept for Milwaukee Street' })

    expect(button.textContent?.trim()).toBe('')
    expect(button.className).toContain('absolute')
  })

  it('opens a dialog with the key and the long caption', async () => {
    setup({ longCaption: 'Source: WisDOT. We added the numbers.' })

    await userEvent.click(
      screen.getByRole('button', { name: 'Enlarge: Concept for Milwaukee Street' }),
    )
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByText('The new ramp would start here.')).toBeTruthy()
    expect(within(dialog).getByText('Source: WisDOT. We added the numbers.')).toBeTruthy()
  })

  it('has no key and still enlarges when it has no items', async () => {
    setup({ items: [] })
    await userEvent.click(
      screen.getByRole('button', { name: 'Enlarge: Concept for Milwaukee Street' }),
    )
    expect(within(screen.getByRole('dialog')).queryByRole('list')).toBeNull()
  })

  it('shows the label in the dialog even without a key or a long caption', async () => {
    setup({ items: [], longCaption: undefined })
    await userEvent.click(
      screen.getByRole('button', { name: 'Enlarge: Concept for Milwaukee Street' }),
    )
    expect(within(screen.getByRole('dialog')).getByText('Figure 2-9')).toBeTruthy()
  })

  it('has no accessibility violations', async () => {
    const { container } = setup()
    await expectAccessible(container)
  })
})
