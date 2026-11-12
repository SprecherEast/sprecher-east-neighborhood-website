// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '2026' })))
    expect(button().textContent).toContain('+$0')
  })

  it('are the very figures the answer card shows, for the average home and for a home estimated (#1111)', async () => {
    const { container } = render(<FactTabs tabs={[tab(WORDS)]} />)
    const answer = () => screen.getByRole('region', { name: 'Your City tax' }).textContent
    expect(answer()).toContain('Up $90 a year, about $7.50 a month')
    expect(heading(container).textContent).toContain('$7.50')
    await estimate('$1,000,600')
    expect(answer()).toContain('Up $180 a year, about $15 a month')
    expect(heading(container).textContent).toContain('$15 more')
  })

  it('show text without placeholders as written, and change nothing without a bill block', async () => {
    const { container } = render(
      <FactTabs tabs={[tab({ value: '+$90 a year', heading: 'One average home' }, false)]} />,
    )
    expect(button().textContent).toContain('+$90')
    expect(heading(container).textContent).toBe('One average home')
  })
})

describe('the tab figure and heading count with the bill (#1096)', () => {
  let frames: ((time: number) => void)[] = []
  let now = 0
  const step = (ms: number) =>
    act(() => {
      now += ms
      const pending = frames
      frames = []
      pending.forEach((frame) => frame(now))
    })
  const yearly = () => Number(/\+\$(\d+)/.exec(button().textContent ?? '')?.[1])

  beforeEach(() => {
    frames = []
    now = 0
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('moves from the old figure to the new one, ending on it', async () => {
    render(<FactTabs tabs={[tab(WORDS)]} />)
    expect(yearly()).toBe(90)
    await estimate('$1,000,600')
    step(0)
    step(500)
    const middle = yearly()
    expect(middle).toBeGreaterThan(90)
    expect(middle).toBeLessThan(180)
    step(2000)
    expect(yearly()).toBe(180)
  })
})
