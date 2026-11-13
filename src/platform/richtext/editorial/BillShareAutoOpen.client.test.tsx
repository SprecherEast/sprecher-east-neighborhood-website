// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TOTAL_PULSE_MS } from '@/platform/ui/ShareBill'
import { COUNT_MS } from '@/platform/ui/useCountedNumber.client'

import { BillShare, OPEN_AFTER_TOTAL_MS } from './BillShare.client'
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

  it('opens only once: closed by the reader, it stays closed for the next value', async () => {
    render(<BillShare {...PROPS} {...city} />)
    await estimate('$700,000')
    wait(OPEN_AFTER_TOTAL_MS)
    breakdown().open = false
    await estimate('$800,000')
    wait(OPEN_AFTER_TOTAL_MS * 2)
    expect(breakdown().open).toBe(false)
  })

  it('never opens for a switch of tax year', () => {
    render(<BillShare {...PROPS} {...city} />)
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    wait(OPEN_AFTER_TOTAL_MS * 2)
    expect(breakdown().open).toBe(false)
  })

  it('never scrolls the page when it opens by itself', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(<BillShare {...PROPS} {...city} />)
    await estimate('$700,000')
    wait(OPEN_AFTER_TOTAL_MS)
    expect(breakdown().open).toBe(true)
    expect(scroll).not.toHaveBeenCalled()
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
  it('fills its bars each time it opens, by itself or by hand (#1163)', async () => {
    render(<BillShare {...PROPS} {...city} />)
    const chart = () => breakdown().querySelector('.chart-fill-x')
    expect(chart()).toBeNull()
    // By hand: the reader opens it
    breakdown().open = true
    fireEvent(breakdown(), new Event('toggle'))
    expect(chart()).not.toBeNull()
    // Thinner bars inside the bill
    expect(breakdown().querySelector('svg.h-3\\.5')).toBeNull()
  })
})
