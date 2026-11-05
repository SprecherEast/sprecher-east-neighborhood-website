// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { SHARED_ROWS_SPACE_2, SUBGRID_FOUR_ROWS, SUBGRID_FOUR_ROWS_EXPLICIT } from './layoutSizes'
import { expectAccessible } from './testing/expectAccessible'
import { Tabs, type TabsItem } from './Tabs.client'

afterEach(cleanup)

const ITEMS: TabsItem[] = [
  { value: 'money', trigger: 'Day-to-day', heading: 'Day-to-day money', panel: <p>Panel one</p> },
  {
    value: 'build',
    trigger: 'Big projects',
    heading: 'Big-project money',
    panel: <p>Panel two</p>,
  },
  { value: 'home', trigger: 'One home', heading: 'One home', panel: <p>Panel three</p> },
]

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

  it('lays the tabs out 2 by 2 on a phone and in one row from sm up, with 44px targets', () => {
    setup()
    const list = screen.getByRole('tablist')

    expect(list.className).toContain('grid-cols-2')
    expect(list.className).toContain('sm:grid-flow-col')
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('min-h-11')
    }
  })

  it('lets the tab buttons share four rows only when asked, with the space the gap would have been (#678)', () => {
    const { rerender } = render(<Tabs label="Budget views" items={ITEMS} defaultValue="money" />)
    const list = () => screen.getByRole('tablist')
    const [tab] = screen.getAllByRole('tab')
    expect(list().className).not.toContain(SUBGRID_FOUR_ROWS_EXPLICIT)
    expect(tab?.className).not.toContain(SUBGRID_FOUR_ROWS)

    rerender(<Tabs label="Budget views" items={ITEMS} defaultValue="money" rows="shared" />)
    expect(list().className).toContain(SUBGRID_FOUR_ROWS_EXPLICIT)
    expect(list().className).toContain(SHARED_ROWS_SPACE_2.list)
    expect(screen.getAllByRole('tab')[0]?.className).toContain(SUBGRID_FOUR_ROWS)
    expect(screen.getAllByRole('tab')[0]?.className).toContain(SHARED_ROWS_SPACE_2.item)
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

    it('makes the selected tab a brighter, glassy green that sits higher than the rest', () => {
      setup()
      const [tab] = screen.getAllByRole('tab')
      expect(tab?.className).toContain('data-[state=active]:border-primary')
      expect(tab?.className).toContain('data-[state=active]:bg-gradient-to-b')
      expect(tab?.className).toContain('data-[state=active]:from-primary/30')
      // A light inner edge, the glass's catch of light
      expect(tab?.className).toContain('data-[state=active]:ring-inset')
      expect(tab?.className).toContain('data-[state=active]:to-primary/10')
      expect(tab?.className).toContain('data-[state=active]:backdrop-blur-md')
      expect(tab?.className).toContain('data-[state=active]:shadow-md')
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

    it('points the selected tab at its panel with a notch on the panel’s edge, in a row of tabs', () => {
      setup()
      const [tab, other] = screen.getAllByRole('tab')
      expect(tab?.className).toContain('sm:data-[state=active]:after:block')
      expect(tab?.className).toContain('after:border-primary')
      expect(tab?.className).not.toMatch(/after:border-primary\//)
      expect(tab?.className).toContain('after:bg-card')
      // The notch is drawn on the selected tab only, and above the panel's own edge
      expect(tab?.className).toContain('data-[state=active]:z-10')
      expect(other?.className).toBe(tab?.className)
    })

    it('has one definition of the space between the tabs and the panel, so the notch lands on the edge', () => {
      const { container } = setup()
      const root = container.firstElementChild as HTMLElement
      expect(root.className).toContain('[--tabs-gap:1rem]')
      expect(root.className).toContain('gap-(--tabs-gap)')
      expect(screen.getAllByRole('tab')[0]?.className).toContain(
        'after:top-[calc(100%+var(--tabs-gap))]',
      )
    })
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
