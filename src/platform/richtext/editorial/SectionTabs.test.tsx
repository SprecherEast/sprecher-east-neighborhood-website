// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { SectionTabs, type SectionTabView } from './SectionTabs'

beforeEach(() => window.history.replaceState(null, '', '/'))
afterEach(cleanup)

const TABS: SectionTabView[] = [
  { label: 'Overview', content: <p>The short version</p> },
  { label: 'The plan', content: <p>A ramp near Milwaukee Street</p> },
  { label: 'What’s next', content: <p>WisDOT’s next steps</p> },
]
const setup = (tabs = TABS) => render(<SectionTabs tabs={tabs} />)

describe('SectionTabs (#1333)', () => {
  it('is a tab list of the labels, the first one selected, named for screen readers', () => {
    setup()
    expect(screen.getByRole('tablist', { name: 'Sections of this article' })).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Overview', 'The plan', 'What’s next'])
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('opens a tab’s content when it is chosen, and the other contents are hidden', async () => {
    setup()
    await userEvent.click(screen.getByRole('tab', { name: 'The plan' }))
    const shown = screen
      .getAllByRole('tabpanel', { hidden: true })
      .filter((panel) => panel.getAttribute('data-state') === 'active')
    expect(shown).toHaveLength(1)
    expect(shown[0]?.textContent).toContain('A ramp near Milwaukee Street')
  })

  it('moves between tabs with the arrow keys', async () => {
    setup()
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(screen.getAllByRole('tab')[1])
    expect(screen.getAllByRole('tab')[1]?.getAttribute('aria-selected')).toBe('true')
  })

  it('keeps the buttons and every tab’s content in one column, in one box', () => {
    const { container } = setup()
    const root = container.firstElementChild as HTMLElement
    expect(root.querySelector('[role="tablist"]')?.parentElement).toBe(root)
    for (const panel of container.querySelectorAll('[role="tabpanel"]')) {
      expect(panel.parentElement).toBe(root)
    }
  })

  it('clears a picture floated before it, so the buttons sit under the introduction’s picture', () => {
    const { container } = setup()
    expect((container.firstElementChild as HTMLElement).className).toContain('clear-both')
  })

  it('writes every tab’s content into the page, each under its label, for a browser with scripting off', () => {
    const html = renderToString(<SectionTabs tabs={TABS} />)
    for (const tab of TABS) expect(html).toContain(tab.label)
    expect(html).toContain('A ramp near Milwaukee Street')
    expect(html).toContain('WisDOT’s next steps')
    // Each label is a heading above its content, hidden only when scripting is on
    expect(html.match(/<h2[^>]*scripted:hidden[^>]*>/g)).toHaveLength(3)
  })

  it('gives each tab a link of its own named from its label', async () => {
    setup()
    await userEvent.click(screen.getByRole('tab', { name: 'The plan' }))
    expect(window.location.hash).toBe('#tab-the-plan')
  })

  it('draws nothing without tabs', () => {
    const { container } = setup([])
    expect(container.innerHTML).toBe('')
  })

  it('passes the accessibility check', async () => {
    const { container } = setup()
    await expectAccessible(container)
  })
})
