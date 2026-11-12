// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Tabs } from './Tabs.client'
import { TAB_ITEMS as ITEMS } from './testing/tabsFixtures'

afterEach(cleanup)

const setup = (count = ITEMS.length) =>
  render(<Tabs label="Budget views" items={ITEMS.slice(0, count)} defaultValue="money" />)

describe('plain, equal tab buttons in one row (#1112)', () => {
  it('shares the row out equally, for two, three and four tabs, with one gap between the buttons', () => {
    for (const count of [2, 3]) {
      const { unmount } = setup(count)
      const list = screen.getByRole('tablist')
      expect(list.className).toContain('grid-flow-col')
      expect(list.className).toContain('auto-cols-[minmax(0,1fr)]')
      expect(list.className).toContain('gap-2')
      expect(screen.getAllByRole('tab')).toHaveLength(count)
      unmount()
    }
  })

  it('gives every tab the same height and centres its label on one line', () => {
    setup()
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('min-h-12')
      expect(tab.className).toContain('items-center')
      expect(tab.className).toContain('justify-center')
      expect(tab.className).toContain('text-center')
      expect(tab.className).toContain('whitespace-nowrap')
      expect(tab.className).toContain('min-w-0')
    }
  })

  it('gives every tab the same classes, so only the selected state tells them apart', () => {
    setup()
    const [first, ...others] = screen.getAllByRole('tab')
    for (const tab of others) expect(tab.className).toBe(first?.className)
  })

  it('is a separate rounded button with a thin border, never joined to the panel', () => {
    setup()
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toMatch(/(^| )rounded-lg( |$)/)
      expect(tab.className).toMatch(/(^| )border( |$)/)
      expect(tab.className).toContain('border-border')
      expect(tab.className).not.toMatch(/after:|before:|rounded-b-none|border-b-0/)
    }
  })

  it('tells the selected tab apart by a primary border, a soft primary fill and a bolder label, beside aria-selected', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    expect(tab?.getAttribute('aria-selected')).toBe('true')
    expect(tab?.className).toContain('data-[state=active]:border-primary')
    expect(tab?.className).toContain('data-[state=active]:bg-primary/10')
    expect(tab?.className).toContain('data-[state=active]:font-semibold')
    expect(tab?.className).toContain('font-medium')
  })

  it('keeps the quiet tabs quiet: muted label, a hover tint, no shadow or lift', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    expect(tab?.className).toContain('text-muted-foreground')
    expect(tab?.className).toContain('hover:bg-surface')
    expect(tab?.className).not.toMatch(/shadow|translate/)
  })

  it('draws a focus ring and takes colours from theme tokens only', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    expect(tab?.className).toContain('focus-visible:outline-2')
    expect(tab?.className).toContain('focus-visible:outline-ring')
    expect(tab?.className).not.toMatch(/#[0-9a-f]{3,6}|\b(red|green|gray|slate)-\d/)
  })

  it('keeps the panel in its own border, with no outline shared with the tab', () => {
    const { container } = setup()
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('gap-2')
    expect(root.className).not.toContain('--tabs-')
    for (const panel of container.querySelectorAll('[role="tabpanel"]')) {
      expect(panel.className).toContain('bg-card')
      expect(panel.className).toContain('border')
      expect(panel.className).not.toContain('border-primary')
      expect(panel.className).not.toMatch(/rounded-t[lr]-none/)
    }
  })
})
