// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BillShare } from './BillShare.client'
import { box, city, PROPS } from './billShareFixtures'

afterEach(cleanup)

describe('BillShare, every amount counts, not only the pie and the receipt (#1096)', () => {
  let frames: ((time: number) => void)[] = []
  let now = 0
  const step = (ms: number) =>
    act(() => {
      now += ms
      const pending = frames
      frames = []
      pending.forEach((frame) => frame(now))
    })
  // The City's tax as the answer card shows it: its first dollar amount
  const cityTotal = () => {
    const answer = screen.getByRole('region', { name: 'Your City tax' }).textContent
    return Number(/\$([\d,]+)/.exec(answer ?? '')?.[1]?.replace(/,/g, ''))
  }
  const breakdownText = () => document.body.textContent ?? ''

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

  it('counts the City’s tax from one year’s amount to the next, not at once', () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const before = cityTotal()
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    step(0)
    expect(cityTotal()).toBe(before)
    step(200)
    const middle = cityTotal()
    step(400)
    const after = cityTotal()
    expect(after).not.toBe(before)
    const [low, high] = [Math.min(before, after), Math.max(before, after)]
    expect(middle).toBeGreaterThan(low)
    expect(middle).toBeLessThan(high)
    step(1000)
    expect(cityTotal()).toBe(after)
  })

  it('counts the City’s tax for a new home value over the longer time', async () => {
    render(
      <BillShare {...PROPS} {...city}>
        x
      </BillShare>,
    )
    const before = cityTotal()
    fireEvent.change(box(), { target: { value: '962600' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Estimate' }))
    })
    step(0)
    step(700)
    const middle = cityTotal()
    expect(middle).toBeGreaterThan(before)
    step(1500)
    expect(cityTotal()).toBeGreaterThan(middle)
    expect(breakdownText()).toMatch(/\$/)
  })
})
