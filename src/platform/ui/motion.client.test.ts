// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion } from './motion.client'

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
