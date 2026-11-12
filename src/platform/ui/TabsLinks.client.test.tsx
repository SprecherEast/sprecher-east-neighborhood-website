// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
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

  it('opens the tab a link names, and brings the tabs into view', () => {
    window.history.replaceState(null, '', '/post#tab-projects')
    setup()
    expect(selected()).toBe('Big projects')
    expect(scrolled).toHaveBeenCalledTimes(1)
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
