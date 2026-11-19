// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TOTAL_PULSE_MS } from '@/platform/ui/ShareBill'
import { COUNT_MS } from '@/platform/ui/useCountedNumber.client'

import { BillShare } from './BillShare.client'
import { OPEN_AFTER_TOTAL_MS } from './useBreakdownAutoOpen.client'
import { city, estimate, PROPS } from './billShareFixtures'

const breakdown = () =>
  screen.getByText('Your City tax breakdown').closest('details') as HTMLDetailsElement
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('BillShare, the City’s breakdown opens after the reader’s first value (#1163)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    // jsdom has no layout, so no scrolling either
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens a set time after the new bill is shown, and not before', async () => {
    render(<BillShare {...PROPS} {...city} />)
    expect(breakdown().open).toBe(false)
    await estimate('$700,000')
    // Less motion (jsdom says so): no count and no flash, so the wait starts at once
    wait(OPEN_AFTER_TOTAL_MS - 1)
    expect(breakdown().open).toBe(false)
    wait(1)
    expect(breakdown().open).toBe(true)
  })

  it('opens again for the next new value when the reader closed it (#1176)', async () => {
    render(<BillShare {...PROPS} {...city} />)
    await estimate('$700,000')
    wait(OPEN_AFTER_TOTAL_MS)
    breakdown().open = false
    await estimate('$800,000')
    wait(OPEN_AFTER_TOTAL_MS)
    expect(breakdown().open).toBe(true)
  })

  it('never opens for a switch of tax year', () => {
    render(<BillShare {...PROPS} {...city} />)
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    wait(OPEN_AFTER_TOTAL_MS * 2)
    expect(breakdown().open).toBe(false)
  })

  it('scrolls to keep the whole bill’s heading in view when it opens by itself (#1178)', async () => {
    const scrollBy = vi.fn()
    vi.stubGlobal('scrollBy', scrollBy)
    render(<BillShare {...PROPS} {...city} />)
    const row = breakdown()
    const heading = screen.getByText('Your whole bill')
    expect(row.getAttribute('data-reveal-anchor')).toBe(heading.id)
    // jsdom has no layout: the heading is 50 px down and the opened row ends far below the screen
    heading.getBoundingClientRect = () => ({ top: 50, bottom: 80 }) as DOMRect
    row.getBoundingClientRect = () => ({ top: 200, bottom: 3000 }) as DOMRect
    await estimate('$700,000')
    wait(OPEN_AFTER_TOTAL_MS)
    expect(row.open).toBe(true)
    // The heading may move up 50 px (no sticky header in jsdom) before it meets the top
    expect(scrollBy).toHaveBeenCalledWith({ top: 50 })
  })

  it('with motion allowed, waits for the count and the total’s flash to end first', async () => {
    let frames: ((time: number) => void)[] = []
    let now = 0
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const step = (ms: number) =>
      act(() => {
        now += ms
        const pending = frames
        frames = []
        pending.forEach((frame) => frame(now))
      })
    render(<BillShare {...PROPS} {...city} />)
    await estimate('$700,000')
    // The count runs: nothing is waited out until the bill has settled
    step(0)
    wait(TOTAL_PULSE_MS + OPEN_AFTER_TOTAL_MS)
    expect(breakdown().open).toBe(false)
    step(COUNT_MS)
    wait(TOTAL_PULSE_MS + OPEN_AFTER_TOTAL_MS - 1)
    expect(breakdown().open).toBe(false)
    wait(1)
    expect(breakdown().open).toBe(true)
  })
  it('fills its bars each time it opens, by itself or by hand (#1163, #1165)', async () => {
    render(<BillShare {...PROPS} {...city} />)
    const chart = () => breakdown().querySelector('.chart-fill-x')
    expect(chart()).toBeNull()
    // By hand: the reader's click readies the fill before the row opens (#1165)
    fireEvent.click(screen.getByText('Your City tax breakdown'))
    expect(chart()).not.toBeNull()
    // Thinner bars inside the bill
    expect(breakdown().querySelector('svg.h-3\\.5')).toBeNull()
  })
})
