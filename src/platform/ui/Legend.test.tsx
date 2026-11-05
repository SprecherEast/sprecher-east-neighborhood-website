// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DiagramKey } from '@/platform/richtext/editorial/DiagramKey'

import { Legend } from './Legend'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const ITEMS = [
  { label: 'North roundabout', text: 'Ramps meet the crossing road.' },
  { label: 'Westbound loop', text: null },
]

describe('Legend', () => {
  it('numbers each marker once, in the accent colour, readable as "Marker N"', async () => {
    const { container } = render(<Legend label="Diagram key" items={ITEMS} />)

    const list = screen.getByRole('list', { name: 'Diagram key' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '1Marker 1: North roundabout:  · Ramps meet the crossing road.',
      '2Marker 2: Westbound loop',
    ])
    const circle = items[0].querySelector('[aria-hidden="true"]')
    expect(circle?.textContent).toBe('1')
    expect(circle?.className).toContain('bg-accent')
    expect(circle?.className).toContain('text-accent-foreground')
    await expectAccessible(container)
  })

  it('draws the Diagram key exactly as before (#662 snapshot)', () => {
    const { container } = render(<DiagramKey items={ITEMS} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('is called "Legend" unless the caller names it', () => {
    render(<Legend items={ITEMS} />)
    expect(screen.getByRole('list', { name: 'Legend' })).toBeTruthy()
  })

  it('renders nothing without items', () => {
    const { container } = render(<Legend items={[]} />)
    expect(container.innerHTML).toBe('')
  })

  describe('the drawer under the image (#636)', () => {
    it('hangs from the image: square top hidden under it, rounded bottom only, still', () => {
      const { container } = render(<Legend items={ITEMS} />)
      const classes = (container.firstElementChild as HTMLElement).className.split(' ')

      // Rounded at the bottom only; no border on top, where the image covers it
      expect(classes).toContain('rounded-b-2xl')
      expect(classes).toContain('border-t-0')
      expect(classes.some((name) => name.startsWith('rounded-t'))).toBe(false)
      // Narrower than the image, so it never meets the image's rounded corners
      expect(classes).toContain('mx-4')
      // A small shadow, and a border, which still shows in dark mode where shadows barely do
      expect(classes).toContain('shadow-sm')
      expect(classes).toContain('border-border')
      // No animation
      expect(classes.some((name) => /transition|animate|duration/.test(name))).toBe(false)
    })

    it('reaches up over the image block margin by the shared sizes, not numbers of its own', () => {
      const { container } = render(<Legend items={ITEMS} />)
      const className = (container.firstElementChild as HTMLElement).className

      expect(className).toContain('-mt-[calc(var(--figure-gap)+var(--legend-overlap))]')
      expect(className).toContain('pt-[calc(var(--legend-overlap)+1rem)]')
    })
  })

  describe('columns (#681)', () => {
    it('sets two columns from `sm` by default, and one with `columns="one"`', () => {
      const { container, rerender } = render(<Legend items={ITEMS} />)
      expect(container.querySelector('ol')?.className).toContain('sm:grid-cols-2')

      rerender(<Legend columns="one" items={ITEMS} />)
      expect(container.querySelector('ol')?.className).toContain('grid-cols-1')
      expect(container.querySelector('ol')?.className).not.toContain('sm:grid-cols-2')
    })
  })

  describe('colour swatches under a chart (#662)', () => {
    const SWATCHES = [
      { label: 'Borrowed', text: '$179.8M', slot: 1 as const },
      { label: 'Other money', text: null, slot: 2 as const, pattern: 'hatch' as const },
    ]

    it('reads as a list of plain-text labels, with no marker numbers', async () => {
      const { container } = render(<Legend marker="swatch" attach="none" items={SWATCHES} />)

      const list = screen.getByRole('list', { name: 'Legend' })
      expect(list.tagName).toBe('UL')
      const items = within(list).getAllByRole('listitem')
      expect(items.map((item) => item.textContent)).toEqual([
        'Borrowed: \u00a0· $179.8M',
        'Other money',
      ])
      expect(container.textContent).not.toMatch(/Marker/)
      await expectAccessible(container)
    })

    it('paints each swatch with its slot colour, and a hatch only where the item has a pattern', () => {
      render(<Legend marker="swatch" attach="none" items={SWATCHES} />)
      const [first, second] = screen
        .getAllByRole('listitem')
        .map((item) => item.querySelector('[data-legend-swatch]') as HTMLElement)

      expect(first.getAttribute('aria-hidden')).toBe('true')
      expect(first.className).toContain('bg-chart-1')
      expect(first.className).not.toContain('bg-hatch')
      expect(second.className).toContain('bg-chart-2')
      expect(second.className).toContain('bg-hatch')
    })

    it('maps every slot 1 to 6 to its own chart colour', () => {
      const items = ([1, 2, 3, 4, 5, 6] as const).map((slot) => ({
        label: `Slot ${slot}`,
        text: null,
        slot,
      }))
      render(<Legend marker="swatch" attach="none" items={items} />)
      const classes = screen
        .getAllByRole('listitem')
        .map((item) => item.querySelector('[data-legend-swatch]')?.className ?? '')
      classes.forEach((name, index) => expect(name).toContain(`bg-chart-${index + 1}`))
    })

    it('is a plain list with attach "none": no drawer, no hang, no shadow', () => {
      const { container } = render(<Legend marker="swatch" attach="none" items={SWATCHES} />)
      const className = (container.firstElementChild as HTMLElement).className
      expect(className).not.toMatch(/rounded-b-2xl|border-t-0|shadow|-mt-|legend-overlap/)
    })

    it('keeps the drawer when a swatch legend asks for it', () => {
      const { container } = render(<Legend marker="swatch" items={SWATCHES} />)
      expect((container.firstElementChild as HTMLElement).className).toContain('rounded-b-2xl')
    })

    it('never puts inline style on the legend', () => {
      const { container } = render(<Legend marker="swatch" attach="none" items={SWATCHES} />)
      expect(container.querySelector('[style]')).toBeNull()
    })
  })
})
