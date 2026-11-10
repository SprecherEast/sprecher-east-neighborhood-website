// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { SUBGRID_FOUR_ROWS, SUBGRID_FOUR_ROWS_EXPLICIT } from '@/platform/ui/layoutSizes'
import { expectAccessible } from '@/platform/ui/testing/expectAccessible'

import { FactTabs } from './FactTabs'
import { toFactTabsProps, type StoredFactTabs } from './factTabs'
import { FACT_TABS_FIXTURE } from './factTabsFixtures'
import { present } from '@/platform/payload/testing/present'

afterEach(cleanup)

const props = toFactTabsProps(FACT_TABS_FIXTURE)
const setup = (shown = props) => render(<FactTabs {...shown} />)

describe('FactTabs', () => {
  it('lets the tab buttons share four rows, so one wrapping title cannot misalign them (#678)', () => {
    setup()
    const list = screen.getByRole('tablist', { name: 'Key facts' })
    const [first] = screen.getAllByRole('tab')

    expect(list.className).toContain(SUBGRID_FOUR_ROWS_EXPLICIT)
    expect(list.className).toContain('gap-y-0')
    expect(first?.className).toContain(SUBGRID_FOUR_ROWS)
    // Card face and card use the same four rows
    expect(first?.firstElementChild?.className).toContain(SUBGRID_FOUR_ROWS)
  })

  it('is a tab list of the key facts, the first one selected', () => {
    setup()
    expect(screen.getByRole('tablist', { name: 'Key facts' })).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
    expect(within(present(tabs[0])).getByText('$477.5M')).toBeTruthy()
    expect(within(present(tabs[0])).getByText('Day-to-day')).toBeTruthy()
    expect(within(present(tabs[0])).getByText('Confirmed')).toBeTruthy()
    expect(within(present(tabs[3])).getByText('Estimate')).toBeTruthy()
  })

  it('puts no link, list or other control inside a tab button', () => {
    setup()
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.querySelector('a, button, dl, dt, dd, input, [tabindex]')).toBeNull()
    }
  })

  it('moves between the tabs with the arrow keys and shows the focus on the tab', async () => {
    setup()
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(screen.getAllByRole('tab')[0])
    await user.keyboard('{ArrowRight}')
    const second = screen.getAllByRole('tab')[1]
    expect(document.activeElement).toBe(second)
    expect(second?.getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(screen.getAllByRole('tab')[3])
  })

  it('gives a tab a 44px minimum height, a selected border and a focus ring', () => {
    setup()
    const [tab] = screen.getAllByRole('tab')
    expect(tab?.className).toMatch(/min-h-11/)
    expect(tab?.className).toMatch(/data-\[state=active\]:border-primary/)
    expect(tab?.className).toMatch(/focus-visible:outline-2/)
  })

  it('shows each panel’s heading, definition and pictures, with the source as a link inside the definition (#980)', () => {
    setup()
    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    expect(panels).toHaveLength(4)
    const first = present(panels[0])
    expect(within(first).getByText(/\$24\.8 million more than in 2026/)).toBeTruthy()
    expect(within(first).queryByText(/^Source:/)).toBeNull()
    // The charts' own captions name the same source, so find the link that sits in the sentence
    const link = within(first)
      .getAllByRole('link', { name: /Executive Operating Budget/ })
      .find((a) => a.closest('p')?.textContent?.includes('$24.8 million more than in 2026'))
    expect(link).toBeTruthy()
    expect(link?.className).toContain('font-semibold')
    expect(within(first).getAllByRole('figure').length).toBeGreaterThanOrEqual(2)
    expect(within(present(panels[3])).getByRole('list')).toBeTruthy()
    expect(within(present(panels[3])).getByText('The Council votes on the budget')).toBeTruthy()
  })

  it('shows the first picture, then the definition, then the other pictures, so a neighbor sees a chart first and the breakdown after the words (#980)', () => {
    setup()
    const [panel] = screen.getAllByRole('tabpanel', { hidden: true })
    const figures = [...present(panel).querySelectorAll('figure')]
    const definition = within(present(panel)).getByText(/\$24\.8 million more than in 2026/)
    const follows = (a?: Element, b?: Element) =>
      a?.compareDocumentPosition(b as Node) === Node.DOCUMENT_POSITION_FOLLOWING
    expect(follows(figures[0], definition)).toBe(true)
    expect(follows(definition, figures[1])).toBe(true)
  })

  it('shows no "Show the numbers" box in a tab, and keeps each chart’s table for screen readers (#980)', () => {
    const { container } = setup()
    expect(screen.queryByText('Show the numbers')).toBeNull()
    expect(container.querySelectorAll('details summary')).not.toContainEqual(
      expect.objectContaining({ textContent: 'Show the numbers' }),
    )
    expect(container.querySelectorAll('.sr-only table').length).toBeGreaterThanOrEqual(3)
  })

  it('falls back to a "Source:" line when the definition never says the link text, so a source is never lost (#980)', () => {
    const [first] = props.tabs
    setup({
      tabs: [{ ...present(first), definition: 'Pays for services.' }, present(props.tabs[3])],
    })
    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    expect(within(present(panels[0])).getByText(/^Source:/)).toBeTruthy()
  })

  it('shows the editor’s heading with scripting on, where Tabs hides its own: one heading each way, never two', () => {
    const { container } = setup()
    const panels = [...container.querySelectorAll('[role="tabpanel"]')]
    for (const panel of panels) {
      const own = [...panel.children].filter((child) => child.tagName === 'H3')
      expect(own.map((h) => h.textContent)).toHaveLength(1)
      const scripted = panel.querySelector(':scope > div > div > h3')
      expect(scripted?.textContent).toBe(own[0]?.textContent)
      // Tabs' heading is for scripting off, this one for scripting on (the media query shows one)
      expect(own[0]?.className).toContain('scripted:hidden')
      expect(scripted?.className).toMatch(/\bhidden\b/)
      expect(scripted?.className).toContain('scripted:block')
    }
  })

  it('reads in full with every panel stacked under its heading when scripting is off', () => {
    const { container } = setup()
    // The headings are visible unless scripting is on (`scripted:hidden`)
    const headings = [...container.querySelectorAll('[role="tabpanel"] > h3')]
    expect(headings.map((h) => h.textContent)).toEqual([
      'Day-to-day money, proposed',
      'Big-project money, proposed',
      'One average home',
      'When the Council votes',
    ])
    expect(headings.every((h) => h.className.includes('scripted:hidden'))).toBe(true)
    expect(container.querySelector('[role="tabpanel"][hidden]')).toBeNull()
  })

  it('still shows the definition of a tab whose pictures were all left out', () => {
    const [first] = props.tabs
    setup({ tabs: [{ ...present(first), panel: [] }, present(props.tabs[3])] })
    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    expect(within(present(panels[0])).getByText(/services residents use every day/)).toBeTruthy()
    expect(within(present(panels[0])).queryByRole('figure')).toBeNull()
  })

  it('draws nothing without tabs', () => {
    const { container } = setup({ tabs: [] })
    expect(container.firstChild).toBeNull()
  })

  it('keeps the tabs in one row, whatever their number (#704)', () => {
    setup({ tabs: props.tabs.slice(0, 3) })
    const list = screen.getByRole('tablist')
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(list.className).toContain('grid-flow-col')
    expect(list.className).not.toContain('grid-cols-2')
  })

  it('shows how sure we are once, in the open panel beside its heading, since the tab leaves it to screen readers (#704, #980)', () => {
    const { container } = setup()
    const [panel] = [...container.querySelectorAll('[role="tabpanel"]')]
    const sure = panel?.querySelector('[data-panel-certainty]')
    expect(sure?.className ?? '').not.toContain('hidden')
    expect(sure?.previousElementSibling?.tagName).toBe('H3')
    expect(sure?.textContent).toContain('Confirmed')
    // The tab already says it to a screen reader
    expect(sure?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows a fact’s explanation in its open panel, not on the tab, so every tab holds the same amount of text (#707)', () => {
    const { container } = setup()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent).join(' ')).not.toContain('The City’s release')
    const panels = [...container.querySelectorAll('[role="tabpanel"]')]
    // The last two words stay together, so the line never ends on a lone "month"
    expect(panels[2]?.querySelector('[data-panel-detail]')?.textContent).toBe(
      'The City’s release says about $7 a\u00a0month',
    )
    // A fact with no explanation gets no empty line
    expect(panels[0]?.querySelector('[data-panel-detail]')).toBeNull()
  })

  it('has no accessibility violations, with charts and a timeline inside', async () => {
    const { container } = setup()
    await expectAccessible(container)
  })

  it('reads a block with a bad chart without throwing', () => {
    const broken = {
      tabs: [{ ...FACT_TABS_FIXTURE.tabs?.[0], panel: [{ blockType: 'chart', kind: 'bar' }] }],
    } as unknown as StoredFactTabs
    expect(() => setup(toFactTabsProps(broken))).not.toThrow()
  })

  it('enlarges a chart in a tab, and still switches tabs before and after (#681)', async () => {
    setup()
    const user = userEvent.setup()
    const enlarge = (name: RegExp) => screen.getAllByRole('button', { name })

    // Tab 1 holds two charts: enlarge the first, close it, and the tab is as it was
    await user.click(enlarge(/Enlarge chart: The day-to-day budget, proposed/)[0] as HTMLElement)
    expect(screen.getByRole('dialog', { name: 'The day-to-day budget, proposed' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('tab')[0]?.getAttribute('aria-selected')).toBe('true')

    // Then another tab, whose own chart enlarges too
    await user.click(screen.getAllByRole('tab')[1] as HTMLElement)
    expect(screen.getAllByRole('tab')[1]?.getAttribute('aria-selected')).toBe('true')
    await user.click(enlarge(/Enlarge chart: How the big projects are paid for/)[0] as HTMLElement)
    expect(screen.getByRole('dialog', { name: /How the big projects are paid for/ })).toBeTruthy()
    expect(document.querySelectorAll('[role="img"]')).toHaveLength(
      // every chart is in the page once: the open one is in the dialog, not drawn twice
      props.tabs.flatMap((tab) => tab.panel.filter((item) => item.kind === 'chart')).length,
    )
  })
})

describe('FactTabs enlarge choice (#686)', () => {
  const withEnlarge = (values: (boolean | undefined)[]) =>
    toFactTabsProps({
      tabs: FACT_TABS_FIXTURE.tabs?.map((t, i) =>
        i === 0 ? { ...t, panel: t.panel?.map((p, j) => ({ ...p, enlarge: values[j] })) } : t,
      ),
    } as StoredFactTabs)
  const panel = () => screen.getAllByRole('tabpanel', { hidden: true })[0] as HTMLElement
  const drawings = () => [...panel().querySelectorAll('[data-chart-drawing]')]

  it('shows no Enlarge button, no zoom cursor and the same size for a chart that is off', () => {
    render(<FactTabs {...withEnlarge([false, true])} />)
    const [off, on] = drawings()
    expect(within(panel()).getAllByRole('button', { name: /Enlarge chart/ })).toHaveLength(1)
    expect(off?.closest('[data-zoom-holder]')).toBeNull()
    expect(on?.closest('[data-zoom-holder]')).not.toBeNull()
    expect(off?.className).toContain('max-w-[var(--chart-small-width)]')
    expect(off?.className).toBe(on?.className)
  })

  it('keeps the Enlarge button on a chart with no value (every stored chart)', () => {
    render(<FactTabs {...withEnlarge([undefined, undefined])} />)
    expect(within(panel()).getAllByRole('button', { name: /Enlarge chart/ })).toHaveLength(2)
  })

  it('opens no dialog when the drawing of a chart that is off is clicked', async () => {
    render(<FactTabs {...withEnlarge([false, false])} />)
    await userEvent.click(drawings()[0] as Element)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
