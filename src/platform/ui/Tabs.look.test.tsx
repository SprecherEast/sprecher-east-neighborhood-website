// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Tabs, type TabsItem } from './Tabs.client'
import { TAB_ITEMS as ITEMS } from './testing/tabsFixtures'

afterEach(cleanup)

const setup = () => render(<Tabs label="Budget views" items={ITEMS} defaultValue="money" />)

describe('looks pressable and ties the selected tab to its area (#688)', () => {
  const panels = (container: HTMLElement) => [...container.querySelectorAll('[role="tabpanel"]')]

  it('raises every tab off the page and lifts it on hover, so it reads as a button', () => {
    setup()
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('cursor-pointer')
      expect(tab.className).toContain('shadow-sm')
      expect(tab.className).toContain('hover:shadow-md')
      // The lift only with motion allowed, and not on the selected tab, whose notch must stay on the panel's edge
      expect(tab.className).toContain('motion-safe:data-[state=inactive]:hover:-translate-y-0.5')
    }
  })

  it('makes the selected tab a brighter, glassy green that sits above the rest', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    expect(tab?.className).toContain('data-[state=active]:border-primary')
    expect(tab?.className).toContain('data-[state=active]:bg-gradient-to-b')
    expect(tab?.className).toContain('data-[state=active]:from-primary/30')
    expect(tab?.className).toContain('data-[state=active]:backdrop-blur-md')
    expect(tab?.className).toContain('data-[state=active]:z-10')
  })

  it('frames each panel in the selected tab’s border, so the tab’s area has an edge on every side', () => {
    const { container } = setup()
    for (const panel of panels(container)) {
      expect(panel.className).toContain('rounded-2xl')
      expect(panel.className).toContain('border-primary')
      // Full strength: the frame is a UI edge, which needs 3:1 against the page (WCAG 1.4.11)
      expect(panel.className).not.toMatch(/border-primary\//)
      expect(panel.className).toContain('bg-card')
      expect(panel.className).toContain('shadow-sm')
    }
  })

  it('has one definition of the space between the tabs and the panel and of the flare size', () => {
    const { container } = setup()
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('[--tabs-gap:0.5rem]')
    expect(root.className).toContain('gap-(--tabs-gap)')
    // The flare sits in the gap, so it can never be taller than the gap
    expect(root.className).toContain('[--tabs-flare:0.5rem]')
  })
})

describe('the selected tab and its panel are one folder-shaped outline (#704)', () => {
  const classesOf = (tab: HTMLElement | undefined) => (tab?.className ?? '').split(' ')

  it('squares the selected tab’s bottom and drops its bottom border, so it opens into the panel', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    expect(tab?.className).toContain('data-[state=active]:rounded-b-none')
    expect(tab?.className).toContain('data-[state=active]:border-b-0')
  })

  it('carries the selected tab down across the gap and over the panel’s top edge, with the side borders', () => {
    setup()
    const [tab, other] = screen.getAllByRole('tab')
    expect(tab?.className).toContain('after:top-full')
    expect(tab?.className).toContain('after:h-[calc(var(--tabs-gap)+1px)]')
    expect(tab?.className).toContain('after:border-x')
    // Full strength, like the panel's own edge (WCAG 1.4.11)
    expect(tab?.className).toContain('after:border-primary')
    expect(tab?.className).not.toMatch(/after:border-primary\//)
    expect(tab?.className).toContain('after:bg-card')
    expect(tab?.className).toContain('data-[state=active]:after:block')
    expect(tab?.className).toContain('data-[state=active]:z-10')
    // Hidden on every tab that isn't selected
    expect(tab?.className).toContain('after:hidden')
    expect(other?.className).toBe(tab?.className)
  })

  it('draws no arrow or notch', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    expect(tab?.className).not.toContain('rotate-45')
    expect(tab?.className).not.toContain('after:size-3')
  })

  it('fades the glass into the panel’s colour and raises nothing, so no seam shows at the join', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    expect(tab?.className).toContain('data-[state=active]:from-primary/30')
    expect(tab?.className).toContain('data-[state=active]:to-transparent')
    expect(tab?.className).toContain('data-[state=active]:hover:bg-card')
    // A shadow or an inset ring would draw a line along the open bottom
    expect(tab?.className).toContain('data-[state=active]:shadow-none')
    expect(tab?.className).not.toContain('ring-inset')
  })

  it('draws the flares as quarter-circle rings of the outline colour, defined once on the root', () => {
    const { container } = setup()
    const root = container.firstElementChild as HTMLElement
    const defined = (name: string) =>
      root.className.split(' ').find((c) => c.startsWith(`[--tabs-flare-${name}:`)) ?? ''
    const left = defined('left')
    const right = defined('right')
    expect(left).toContain('circle_at_0_0')
    expect(right).toContain('circle_at_100%_0')
    for (const flare of [left, right]) {
      expect(flare).toContain('var(--tabs-flare)')
      // The outline's colour and the panel's fill, not literal ones
      expect(flare).toContain('var(--color-primary)')
      expect(flare).toContain('var(--color-card)')
    }
  })

  it('puts both flares level with the panel’s edge, one on each side of the tab’s base', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    const classes = classesOf(tab)
    expect(classes).toContain(
      'before:[background-image:var(--tabs-flare-left),var(--tabs-flare-right)]',
    )
    expect(classes).toContain('before:[background-position:left_top,right_top]')
    expect(classes).toContain('before:h-(--tabs-flare)')
    expect(classes).toContain('before:hidden')
    // Above the extension, so the flare's fill hides the straight wall beside each curve
    expect(classes).toContain('before:z-10')
    expect(classes).toContain('data-[state=active]:before:block')
  })

  it('leaves out the flare on the outer side of the first and last tab, where the outline runs on into the panel’s edge', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    const classes = classesOf(tab)
    // The first tab keeps only its right flare, the last only its left, a lone tab neither
    expect(classes).toContain('first:before:[background-image:var(--tabs-flare-right)]')
    expect(classes).toContain('first:before:[background-position:right_top]')
    expect(classes).toContain('last:before:[background-image:var(--tabs-flare-left)]')
    expect(classes).toContain('last:before:[background-position:left_top]')
    expect(classes).toContain('only:before:[background-image:none]')
  })

  it('squares the panel’s top corner under the first and the last tab, when scripting runs', () => {
    const { container } = setup()
    const [first, middle, last] = [...container.querySelectorAll('[role="tabpanel"]')]
    expect(first?.className).toContain('scripted:rounded-tl-none')
    expect(first?.className).not.toContain('rounded-tr-none')
    expect(last?.className).toContain('scripted:rounded-tr-none')
    expect(last?.className).not.toContain('rounded-tl-none')
    expect(middle?.className).not.toContain('rounded-tl-none')
    expect(middle?.className).not.toContain('rounded-tr-none')
  })

  it('squares both corners of a panel that has the only tab', () => {
    const [only] = ITEMS
    const { container } = render(
      <Tabs label="One view" items={[only as TabsItem]} defaultValue="money" />,
    )
    const panel = container.querySelector('[role="tabpanel"]')
    expect(panel?.className).toContain('scripted:rounded-tl-none')
    expect(panel?.className).toContain('scripted:rounded-tr-none')
  })
})
