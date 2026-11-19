// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Tabs, type TabsItem } from './Tabs.client'
import { TAB_ITEMS } from './testing/tabsFixtures'

const scrolled = vi.fn()
const selected = () =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')
    ?.textContent

beforeEach(() => {
  window.history.replaceState(null, '', '/post')
  Element.prototype.scrollIntoView = scrolled
  scrolled.mockClear()
})
afterEach(cleanup)

const ITEMS: TabsItem[] = TAB_ITEMS.map((item, index) =>
  index === 1 ? { ...item, anchor: 'tab-projects' } : item,
)
const setup = (items = ITEMS) =>
  render(<Tabs label="Budget views" items={items} defaultValue="money" />)

describe('a link for every tab (#1097)', () => {
  it('puts the chosen tab in the address, replacing the entry so Back leaves the page', async () => {
    setup()
    const before = window.history.length
    await userEvent.click(screen.getByRole('tab', { name: 'Big projects' }))
    expect(window.location.hash).toBe('#tab-projects')
    expect(window.history.length).toBe(before)
  })

  it('uses the tab’s value as its name when no anchor is given', async () => {
    setup()
    await userEvent.click(screen.getByRole('tab', { name: 'One home' }))
    expect(window.location.hash).toBe('#home')
  })

  it('leaves the address alone on first load', () => {
    setup()
    expect(window.location.hash).toBe('')
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('opens the tab a link names; the browser has already scrolled to its target', () => {
    window.history.replaceState(null, '', '/post#tab-projects')
    setup()
    expect(selected()).toBe('Big projects')
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('shows the first tab for a name it does not know', () => {
    window.history.replaceState(null, '', '/post#nothing-here')
    setup()
    expect(selected()).toBe('Day-to-day')
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('follows the address when it changes on the page, as a link or Back does', () => {
    setup()
    act(() => {
      window.history.replaceState(null, '', '/post#home')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(selected()).toBe('One home')
  })

  it('does not mistake a malformed address for a tab', () => {
    window.history.replaceState(null, '', '/post#%E0%A4%A')
    setup()
    expect(selected()).toBe('Day-to-day')
  })

  it('follows the arrow keys the same way, since Radix opens a tab on focus', async () => {
    setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Day-to-day' }))
    await userEvent.keyboard('{ArrowRight}')
    expect(selected()).toBe('Big projects')
    expect(window.location.hash).toBe('#tab-projects')
  })

  const twoBlocks = () =>
    render(
      <>
        <Tabs label="First" items={ITEMS} defaultValue="money" />
        <Tabs label="Second" items={ITEMS} defaultValue="money" />
      </>,
    )
  const states = () => screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-selected'))

  it('gives each of two tabbed blocks with the same names a link of its own', async () => {
    twoBlocks()
    await userEvent.click(screen.getAllByRole('tab')[4] as HTMLElement)
    expect(window.location.hash).toBe('#tab-projects-2')
    expect(states()).toEqual(['true', 'false', 'false', 'false', 'true', 'false'])
  })

  it('opens the second block’s tab from its link and leaves the first block alone', () => {
    window.history.replaceState(null, '', '/post#tab-projects-2')
    twoBlocks()
    expect(states()).toEqual(['true', 'false', 'false', 'false', 'true', 'false'])
  })

  it('opens the first block’s tab from the plain link', () => {
    window.history.replaceState(null, '', '/post#tab-projects')
    twoBlocks()
    expect(states()).toEqual(['false', 'true', 'false', 'true', 'false', 'false'])
  })
})

describe('a tab link opens its tab before the script runs (#1309)', () => {
  it('gives every tab a link target, out of the flow, in tab order', () => {
    const { container } = setup()
    const targets = [...container.querySelectorAll<HTMLElement>('[data-tab-target]')]
    expect(targets.map((target) => target.id)).toEqual(['money', 'tab-projects', 'home'])
    expect(targets.map((target) => target.dataset.tabTarget)).toEqual(['0', '1', '2'])
    for (const target of targets) {
      expect(target.getAttribute('aria-hidden')).toBe('true')
      expect(target.className).toContain('absolute')
      expect(target.className).toContain('scroll-mt-')
    }
  })

  it('numbers every tab button and panel, so the rules can match them to a target', () => {
    const { container } = setup()
    expect(screen.getAllByRole('tab').map((tab) => tab.dataset.tabIndex)).toEqual(['0', '1', '2'])
    expect(
      [...container.querySelectorAll<HTMLElement>('[role="tabpanel"]')].map(
        (panel) => panel.dataset.tabIndex,
      ),
    ).toEqual(['0', '1', '2'])
  })

  it('leaves the rules in charge until the script has chosen the tab, then hands over', () => {
    const { container } = setup()
    // Effects have run by now; the server's first render has no such mark (checked below)
    expect(container.querySelector('[data-tab-names]')?.hasAttribute('data-tabs-ready')).toBe(true)
    expect(
      renderToString(<Tabs label="Budget views" items={ITEMS} defaultValue="money" />),
    ).not.toContain('data-tabs-ready')
  })

  it('does not scroll again when the browser already followed the link to its target', () => {
    window.history.replaceState(null, '', '/post#tab-projects')
    setup()
    expect(selected()).toBe('Big projects')
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('scrolls when no target took the link, as for a repeated name in a later block', () => {
    window.history.replaceState(null, '', '/post#tab-projects-2')
    render(
      <>
        <Tabs label="First" items={ITEMS} defaultValue="money" />
        <Tabs label="Second" items={ITEMS} defaultValue="money" />
      </>,
    )
    const [, second] = screen.getAllByRole('tablist')
    const chosen = within(second as HTMLElement)
      .getAllByRole('tab')
      .find((tab) => tab.getAttribute('aria-selected') === 'true')
    expect(chosen?.textContent).toBe('Big projects')
    expect(scrolled).toHaveBeenCalledTimes(1)
  })
})
