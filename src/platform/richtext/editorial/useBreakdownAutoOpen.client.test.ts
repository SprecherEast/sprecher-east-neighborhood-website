// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TOTAL_PULSE_MS } from '@/platform/ui/ShareBill'

import { OPEN_AFTER_TOTAL_MS, useBreakdownAutoOpen } from './useBreakdownAutoOpen.client'

// A real <details> for the hook's row, closed
const withRow = () => {
  const row = document.createElement('details')
  document.body.append(row)
  return row
}

describe('useBreakdownAutoOpen (#1163, #1165)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  const setup = () => {
    const row = withRow()
    const hook = renderHook(({ pulse }) => useBreakdownAutoOpen(pulse), {
      initialProps: { pulse: 0 },
    })
    hook.result.current.rowRef.current = row
    return { row, ...hook }
  }

  it('pauses only briefly after the total, so the row opens before the reader reacts (#1170)', () => {
    expect(OPEN_AFTER_TOTAL_MS).toBe(400)
  })

  it('opens once, after the armed bill’s flash and the pause, with the fill restarted first', () => {
    const { row, result, rerender } = setup()
    act(() => result.current.arm(true))
    rerender({ pulse: 1 })
    // Less motion (jsdom says so): no flash to wait out
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS - 1))
    expect(row.open).toBe(false)
    // The fill is readied while the row is still closed, then the row opens: record the openings
    // counted at the moment `open` is set
    const order: number[] = []
    const native = Object.getOwnPropertyDescriptor(HTMLDetailsElement.prototype, 'open')
    Object.defineProperty(row, 'open', {
      configurable: true,
      get: () => native?.get?.call(row),
      set: (value: boolean) => {
        order.push(result.current.openings)
        native?.set?.call(row, value)
      },
    })
    act(() => vi.advanceTimersByTime(1))
    expect(row.open).toBe(true)
    expect(result.current.openings).toBe(1)
    expect(order).toEqual([1])
  })

  it('waits for the flash too when motion is allowed', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const { row, result, rerender } = setup()
    act(() => result.current.arm(true))
    rerender({ pulse: 1 })
    act(() => vi.advanceTimersByTime(TOTAL_PULSE_MS + OPEN_AFTER_TOTAL_MS - 1))
    expect(row.open).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(row.open).toBe(true)
  })

  it('is not armed by an estimate that changes nothing, so a later year switch never opens it', () => {
    const { row, result, rerender } = setup()
    act(() => result.current.arm(false))
    rerender({ pulse: 1 })
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS * 3))
    expect(row.open).toBe(false)
  })

  it('starts the wait over when another bill settles first, and opens only after it', () => {
    const { row, result, rerender } = setup()
    act(() => result.current.arm(true))
    rerender({ pulse: 1 })
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS / 2))
    // A year switch lands mid-wait: its own bill settles
    rerender({ pulse: 2 })
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS / 2))
    expect(row.open).toBe(false)
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS / 2))
    expect(row.open).toBe(true)
  })

  it('leaves no timer behind when the page goes', () => {
    const { result, rerender, unmount } = setup()
    act(() => result.current.arm(true))
    rerender({ pulse: 1 })
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('counts a reader’s own opening as its one opening, and never opens after that', () => {
    const { row, result, rerender } = setup()
    // The reader opens it before estimating
    act(() => result.current.onOpening())
    row.open = true
    expect(result.current.openings).toBe(1)
    act(() => result.current.arm(true))
    rerender({ pulse: 1 })
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS))
    // Already open: it stays so, and the fill is not replayed
    expect(result.current.openings).toBe(1)
    row.open = false
    act(() => result.current.arm(true))
    rerender({ pulse: 2 })
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS * 2))
    expect(row.open).toBe(false)
  })

  it('does not count itself as opened when it has no row to open', () => {
    const { result, rerender } = renderHook(({ pulse }) => useBreakdownAutoOpen(pulse), {
      initialProps: { pulse: 0 },
    })
    act(() => result.current.arm(true))
    rerender({ pulse: 1 })
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS))
    // The row appears later (the bill became whole): the next estimate still opens it
    const row = withRow()
    result.current.rowRef.current = row
    act(() => result.current.arm(true))
    rerender({ pulse: 2 })
    act(() => vi.advanceTimersByTime(OPEN_AFTER_TOTAL_MS))
    expect(row.open).toBe(true)
  })
})
