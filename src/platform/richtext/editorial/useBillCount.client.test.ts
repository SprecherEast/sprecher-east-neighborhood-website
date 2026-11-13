// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { COUNT_MS, YEAR_COUNT_MS } from '@/platform/ui/useCountedNumber.client'

import { useBillCount } from './useBillCount.client'

// jsdom has no matchMedia, so counts land at once, as for a reader who asked for less motion
describe('useBillCount (#1165)', () => {
  it('shows the value and year as given, with no flash on the first bill', () => {
    const { result } = renderHook(() => useBillCount(500_000, 1))
    expect(result.current.shownValue).toBe(500_000)
    expect(result.current.position).toBe(1)
    expect(result.current.pulse).toBe(0)
  })

  it('flashes once each time a different bill has settled: a new value or a new year', () => {
    const { result, rerender } = renderHook(({ value, year }) => useBillCount(value, year), {
      initialProps: { value: 500_000, year: 1 },
    })
    act(() => result.current.countWith(COUNT_MS))
    rerender({ value: 700_000, year: 1 })
    expect(result.current.shownValue).toBe(700_000)
    expect(result.current.pulse).toBe(1)
    act(() => result.current.countWith(YEAR_COUNT_MS))
    rerender({ value: 700_000, year: 0 })
    expect(result.current.position).toBe(0)
    expect(result.current.pulse).toBe(2)
    // The same bill again flashes nothing
    rerender({ value: 700_000, year: 0 })
    expect(result.current.pulse).toBe(2)
  })
})
