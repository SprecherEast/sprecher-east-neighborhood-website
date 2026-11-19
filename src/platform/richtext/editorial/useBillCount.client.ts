'use client'

import { useEffect, useRef, useState } from 'react'

import { COUNT_MS, YEAR_COUNT_MS, useCountedNumber } from '@/platform/ui/useCountedNumber.client'

/** The year's position is counted in whole numbers, so each year step is this many of them */
const YEAR_STEPS = 1000

/**
 * How the whole bill moves to a new home value or year (#1087, #1096, #1165): the value counts over
 * the length last asked for (`countWith`: the long count for a new value, the short one for a year),
 * the year's position counts between two years so the rates blend, and `pulse` moves once each time a
 * bill that differs from the last has finished counting, so the total flashes once. With reduced
 * motion the counts land at once.
 */
export function useBillCount(value: number, yearIndex: number) {
  const [countMs, countWith] = useState(COUNT_MS)
  const shownValue = useCountedNumber(value, { durationMs: countMs })
  const yearPosition = useCountedNumber(yearIndex * YEAR_STEPS, { durationMs: YEAR_COUNT_MS })
  const [pulse, setPulse] = useState(0)
  const lastBill = useRef<string | null>(null)
  const billKey = `${yearIndex}:${value}`
  const settled = shownValue === value && yearPosition === yearIndex * YEAR_STEPS
  useEffect(() => {
    if (!settled) return
    if (lastBill.current !== null && lastBill.current !== billKey) setPulse((count) => count + 1)
    lastBill.current = billKey
  }, [settled, billKey])
  return { shownValue, position: yearPosition / YEAR_STEPS, pulse, countWith }
}
