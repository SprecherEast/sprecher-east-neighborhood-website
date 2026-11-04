// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

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
})
