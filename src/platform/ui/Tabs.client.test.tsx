// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { expectAccessible } from './testing/expectAccessible'
import { Tabs } from './Tabs.client'
import { TAB_ITEMS as ITEMS } from './testing/tabsFixtures'

afterEach(cleanup)

function setup(defaultValue = 'money') {
  return render(<Tabs label="Budget views" items={ITEMS} defaultValue={defaultValue} />)
}

describe('Tabs (#661)', () => {
  it('is a tab list named by its label, with one tab per item', () => {
    setup()

    expect(screen.getByRole('tablist', { name: 'Budget views' })).toBeTruthy()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Day-to-day',
      'Big projects',
      'One home',
    ])
  })

  it('selects the default tab on the first render, so nothing moves after load', () => {
    setup('build')
    const [first, second] = screen.getAllByRole('tab')

    expect(first?.getAttribute('aria-selected')).toBe('false')
    expect(second?.getAttribute('aria-selected')).toBe('true')
    expect(second?.getAttribute('data-state')).toBe('active')
  })

  it('renders every panel and never sets hidden, so all of them are readable without JavaScript', () => {
    const { container } = setup()
    const panels = container.querySelectorAll('[role="tabpanel"]')

    expect(panels).toHaveLength(3)
    expect([...panels].map((panel) => panel.hasAttribute('hidden'))).toEqual([false, false, false])
    expect([...panels].map((panel) => panel.getAttribute('data-state'))).toEqual([
      'active',
      'inactive',
      'inactive',
    ])
    for (const text of ['Panel one', 'Panel two', 'Panel three']) {
      expect(screen.getByText(text)).toBeTruthy()
    }
  })

  it('hides inactive panels and the headings only while scripting runs', () => {
    const { container } = setup()
    const [active, inactive] = container.querySelectorAll('[role="tabpanel"]')

    expect(inactive?.className).toContain('scripted:data-[state=inactive]:hidden')
    expect(active?.hasAttribute('hidden')).toBe(false)
    // Without scripting the tab list is hidden and each panel opens with its heading
    expect(screen.getByRole('tablist').className).toMatch(/(^| )hidden( |$)/)
    expect(screen.getByRole('tablist').className).toContain('scripted:grid')
    const heading = within(active as HTMLElement).getByRole('heading', {
      name: 'Day-to-day money',
    })
    expect(heading.className).toContain('scripted:hidden')
  })

  it('names each panel by its tab', () => {
    setup()

    expect(
      screen
        .getAllByRole('tabpanel', { hidden: true })
        .map((p) => p.getAttribute('aria-labelledby')),
    ).toEqual(screen.getAllByRole('tab').map((tab) => tab.id))
  })

  it('lays the tabs out in one row at every width, with targets at the kit’s 48px height', () => {
    setup()
    const list = screen.getByRole('tablist')
    expect(list.className).toContain('grid-flow-col')
    expect(list.className).toContain('auto-cols-[minmax(0,1fr)]')
    expect(list.className).not.toContain('grid-cols-2')
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('min-h-12')
    }
  })

  it('changes the selected tab on click', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('tab', { name: 'One home' }))

    expect(screen.getByRole('tab', { name: 'One home' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Day-to-day' }).getAttribute('aria-selected')).toBe(
      'false',
    )
    expect(
      screen.getByText('Panel three').closest('[role="tabpanel"]')?.getAttribute('data-state'),
    ).toBe('active')
  })

  it('moves between tabs with the arrow keys, Home and End', async () => {
    const user = userEvent.setup()
    setup()
    const tab = (name: string) => screen.getByRole('tab', { name })

    tab('Day-to-day').focus()
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(tab('Big projects'))
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(tab('One home'))
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(tab('Day-to-day'))
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(tab('One home'))
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(tab('Day-to-day'))
  })

  it('fades a panel in only after the reader changed tab, and only with motion allowed', async () => {
    const user = userEvent.setup()
    const { container } = setup()
    const panel = container.querySelectorAll('[role="tabpanel"]')[1]

    expect(panel?.className).toContain('motion-safe:group-data-[changed]/tabs:data-[state=active]')
    expect(container.firstElementChild?.hasAttribute('data-changed')).toBe(false)

    await user.click(screen.getByRole('tab', { name: 'Big projects' }))
    expect(container.firstElementChild?.hasAttribute('data-changed')).toBe(true)
  })

  it('lets the heading level be chosen, h3 by default', () => {
    const { container, rerender } = setup()
    expect(container.querySelectorAll('h3')).toHaveLength(3)

    rerender(<Tabs label="Budget views" items={ITEMS} defaultValue="money" headingAs="h4" />)
    expect(container.querySelectorAll('h4')).toHaveLength(3)
  })

  it('defines the scripted variant on the scripting media feature', () => {
    const css = readFileSync(join(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')

    expect(css).toContain('@custom-variant scripted (@media (scripting: enabled));')
  })

  it('has no accessibility violations', async () => {
    const { container } = setup()

    await expectAccessible(container)
  })
})
