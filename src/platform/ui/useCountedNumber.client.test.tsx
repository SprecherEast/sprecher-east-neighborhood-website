// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COUNT_MS, YEAR_COUNT_MS, useCountedNumber } from './useCountedNumber.client'

let frames: ((time: number) => void)[] = []
let now = 0

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
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const step = (ms: number) =>
  act(() => {
    now += ms
    const pending = frames
    frames = []
    pending.forEach((frame) => frame(now))
  })

function Counter({ target }: { target: number }) {
  return <p data-testid="n">{useCountedNumber(target, { durationMs: 400 })}</p>
}
function SlowCounter({ target }: { target: number }) {
  return <p data-testid="n">{useCountedNumber(target)}</p>
}
const shown = () => Number(screen.getByTestId('n').textContent)

describe('useCountedNumber', () => {
  it('starts at the number it is given, with no count', () => {
    render(<Counter target={500} />)
    expect(shown()).toBe(500)
  })

  it('counts from the old number to the new one, in whole numbers, ending exactly on it', () => {
    const { rerender } = render(<Counter target={100} />)
    rerender(<Counter target={300} />)
    step(0)
    expect(shown()).toBe(100)
    step(200)
    expect(shown()).toBeGreaterThan(100)
    expect(shown()).toBeLessThan(300)
    expect(Number.isInteger(shown())).toBe(true)
    step(400)
    expect(shown()).toBe(300)
  })

  it('takes a second and a half by default, long enough to be seen', () => {
    const { rerender } = render(<SlowCounter target={100} />)
    rerender(<SlowCounter target={300} />)
    step(0)
    step(1000)
    expect(shown()).toBeLessThan(300)
    step(1500)
    expect(shown()).toBe(300)
  })

  it('counts down as well as up', () => {
    const { rerender } = render(<Counter target={300} />)
    rerender(<Counter target={100} />)
    step(0)
    step(150)
    expect(shown()).toBeLessThan(300)
    expect(shown()).toBeGreaterThan(100)
    step(400)
    expect(shown()).toBe(100)
  })

  it('jumps straight to the new number for a reader who asked for less motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion') }))
    const { rerender } = render(<Counter target={100} />)
    rerender(<Counter target={300} />)
    expect(shown()).toBe(300)
  })

  it('starts the next count from where the last one had got to', () => {
    const { rerender } = render(<Counter target={0} />)
    rerender(<Counter target={1000} />)
    step(0)
    step(200)
    const middle = shown()
    rerender(<Counter target={0} />)
    step(0)
    expect(shown()).toBe(middle)
    step(500)
    expect(shown()).toBe(0)
  })
})

describe('a running count keeps its own duration (#1087)', () => {
  function Timed({ target, ms }: { target: number; ms: number }) {
    return <p data-testid="n">{useCountedNumber(target, { durationMs: ms })}</p>
  }

  it('is not restarted when only the duration changes mid-count', () => {
    const { rerender } = render(<Timed target={0} ms={1000} />)
    rerender(<Timed target={1000} ms={1000} />)
    step(0)
    step(500)
    const reached = shown()
    expect(reached).toBeGreaterThan(0)
    // The caller now asks for a shorter count for the next change; this one carries on
    rerender(<Timed target={1000} ms={200} />)
    step(0)
    expect(shown()).toBeGreaterThanOrEqual(reached)
    step(600)
    expect(shown()).toBe(1000)
  })

  it('uses the new duration for the next change of target', () => {
    const { rerender } = render(<Timed target={0} ms={1000} />)
    rerender(<Timed target={1000} ms={200} />)
    step(0)
    step(300)
    expect(shown()).toBe(1000)
  })
})

describe('the quick count for a switch of tax year (#1087)', () => {
  it('is a third as long as the count for a new home value', () => {
    expect(YEAR_COUNT_MS).toBe(500)
    expect(YEAR_COUNT_MS).toBeLessThan(COUNT_MS)
  })
})

describe("the count and the total's flash", () => {
  it("last as long: the flash's CSS duration is the count's, defined once here", () => {
    const css = readFileSync('src/platform/theme/tailwind.css', 'utf8')
    expect(css).toContain(`animation: total-pulse ${COUNT_MS / 1000}s ease-out`)
  })
})

describe("the total's flash sits behind its text (#1095)", () => {
  const css = readFileSync('src/platform/theme/tailwind.css', 'utf8')
  const utility = css.slice(css.indexOf('@utility total-pulse'))
  const keyframes = css.slice(
    css.indexOf('@keyframes total-pulse'),
    css.indexOf('@utility total-pulse'),
  )

  it('is a layer of its own, drawn below the row and its text', () => {
    expect(utility).toContain('isolation: isolate')
    expect(utility).toContain('&::before')
    expect(utility).toContain('z-index: -1')
    expect(utility).toContain('pointer-events: none')
  })

  it('moves the animation to that layer, so the row itself is never painted', () => {
    const layer = utility.slice(utility.indexOf('&::before'))
    expect(layer).toContain('animation: total-pulse')
  })

  it('starts soft enough to keep the text readable', () => {
    const peak = Number(/var\(--accent\) (\d+)%/.exec(keyframes)?.[1])
    expect(peak).toBeLessThanOrEqual(30)
  })
})
