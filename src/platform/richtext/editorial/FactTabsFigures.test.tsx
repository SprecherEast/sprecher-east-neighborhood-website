// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { present } from '@/platform/payload/testing/present'

import { BARS, estimate, PROPS } from './billShareFixtures'
import { FactTabs } from './FactTabs'
import { toFactTabsProps } from './factTabs'
import { FACT_TABS_FIXTURE } from './factTabsFixtures'

afterEach(cleanup)

const [first] = toFactTabsProps(FACT_TABS_FIXTURE).tabs
const tab = (text: { value: string; heading: string }, withBill = true) => ({
  ...present(first),
  fact: { ...present(first).fact, value: text.value },
  heading: text.heading,
  panel: withBill
    ? [
        { kind: 'billShare' as const, billShare: PROPS },
        { kind: 'chart' as const, enlarge: false, spec: BARS },
      ]
    : [{ kind: 'chart' as const, enlarge: false, spec: BARS }],
})
const WORDS = { value: '+{yearly} a year', heading: 'Your share: about {monthly} more a month' }
const button = () => screen.getByRole('tab')
const heading = (container: HTMLElement) =>
  present(container.querySelector('[role="tabpanel"] h3.scripted\\:block'))

describe('the tab figure and heading with placeholders (#1029)', () => {
  it('start with the average home’s numbers, as the server writes them', () => {
    const { container } = render(<FactTabs tabs={[tab(WORDS)]} />)
    expect(within(button()).getByText(/\+\$90/)).toBeTruthy()
    expect(heading(container).textContent).toBe('Your share: about $7.50 more a month')
  })

  it('follow the home estimated and the year chosen', async () => {
    const { container } = render(<FactTabs tabs={[tab(WORDS)]} />)
    await estimate('$1,000,600')
    expect(button().textContent).toContain('+$180')
    expect(heading(container).textContent).toBe('Your share: about $15 more a month')
    // The year chosen counts too: 2026 has no increase
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /2026 rates/ })))
    expect(button().textContent).toContain('+$0')
  })

  it('show text without placeholders as written, and change nothing without a bill block', async () => {
    const { container } = render(
      <FactTabs tabs={[tab({ value: '+$90 a year', heading: 'One average home' }, false)]} />,
    )
    expect(button().textContent).toContain('+$90')
    expect(heading(container).textContent).toBe('One average home')
  })
})
