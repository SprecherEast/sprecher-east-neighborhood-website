// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion, scrollToUnlessVisible } from './motion.client'

function reduceMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('prefersReducedMotion', () => {
  it('reads the reader’s setting', () => {
    reduceMotion(true)
    expect(prefersReducedMotion()).toBe(true)
    reduceMotion(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('counts a browser that cannot say as asking for none, so nothing animates', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(true)
  })
})

describe('scrollToUnlessVisible', () => {
  const box = (top: number, bottom: number) => {
    const element = document.createElement('div')
    element.scrollIntoView = vi.fn()
    element.getBoundingClientRect = () => ({ top, bottom }) as DOMRect
    return element
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('innerHeight', 800)
    reduceMotion(false)
  })

  it('does not scroll when the whole element is already on screen', async () => {
    const element = box(100, 600)
    await scrollToUnlessVisible(element)
    expect(element.scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls when the element sits under the sticky header, which its scroll margin keeps clear', async () => {
    const element = box(40, 600)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      scrollMarginTop: '88px',
    } as CSSStyleDeclaration)
    const done = scrollToUnlessVisible(element)
    await vi.advanceTimersByTimeAsync(2500)
    await done
    expect(element.scrollIntoView).toHaveBeenCalled()
  })

  it("does not scroll when the element is just below the header's clearance", async () => {
    const element = box(100, 600)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      scrollMarginTop: '88px',
    } as CSSStyleDeclaration)
    await scrollToUnlessVisible(element)
    expect(element.scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls smoothly, by the least distance, when part of it is below the screen', async () => {
    const element = box(300, 1100)
    const done = scrollToUnlessVisible(element)
    await vi.advanceTimersByTimeAsync(2500)
    await done
    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' })
  })

  it('does not scroll at all for a reader who asked for less motion', async () => {
    reduceMotion(true)
    const element = box(900, 1500)
    await scrollToUnlessVisible(element)
    expect(element.scrollIntoView).not.toHaveBeenCalled()
  })

  it('finishes when the page stops moving, not only at the time limit', async () => {
    let y = 0
    vi.stubGlobal('scrollY', 0)
    Object.defineProperty(window, 'scrollY', { get: () => y, configurable: true })
    const element = box(900, 1500)
    let finished = false
    const done = scrollToUnlessVisible(element).then(() => {
      finished = true
    })
    for (let i = 0; i < 10; i++) {
      y += 40
      await vi.advanceTimersByTimeAsync(16)
    }
    expect(finished).toBe(false)
    await vi.advanceTimersByTimeAsync(300)
    await done
    expect(finished).toBe(true)
  })
})
