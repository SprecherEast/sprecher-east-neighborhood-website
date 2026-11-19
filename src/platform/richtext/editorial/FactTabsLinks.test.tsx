// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FactTabs } from './FactTabs'
import { toFactTabsProps } from './factTabs'
import { tabAnchors } from './tabAnchors'
import { FACT_TABS_FIXTURE } from './factTabsFixtures'

const props = toFactTabsProps(FACT_TABS_FIXTURE)
const label = (index: number) => props.tabs[index]?.fact.label ?? ''
const selected = () =>
  screen.getAllByRole('tab').findIndex((tab) => tab.getAttribute('aria-selected') === 'true')

beforeEach(() => {
  window.history.replaceState(null, '', '/post')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(cleanup)

describe('every fact tab has a link of its own (#1097)', () => {
  it('names the chosen tab in the address from its label, with no setting on the block', async () => {
    render(<FactTabs {...props} />)
    await userEvent.click(screen.getAllByRole('tab')[1] as HTMLElement)
    expect(window.location.hash).toMatch(/^#tab-[a-z0-9-]+$/)
    expect(window.location.hash).toContain(label(1).toLowerCase().split(' ')[0] ?? '')
  })

  it('opens the tab a shared link names', () => {
    const [, second] = tabAnchors(props.tabs.map((tab) => tab.fact.label))
    window.history.replaceState(null, '', `/post#${second}`)
    render(<FactTabs {...props} />)
    expect(selected()).toBe(1)
  })
})
