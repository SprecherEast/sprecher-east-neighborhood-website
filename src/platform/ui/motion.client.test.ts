// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { EXPAND_MS, holdScrollAnchor, prefersReducedMotion } from './motion.client'

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

describe('holdScrollAnchor (#1170)', () => {
  afterEach(() => document.documentElement.removeAttribute('data-expanding'))

  it('marks the page while a row expands, and clears it after, so the browser does not scroll with the growth', () => {
    vi.useFakeTimers()
    holdScrollAnchor()
    expect(document.documentElement.hasAttribute('data-expanding')).toBe(true)
    vi.advanceTimersByTime(EXPAND_MS)
    expect(document.documentElement.hasAttribute('data-expanding')).toBe(true)
    vi.advanceTimersByTime(100)
    expect(document.documentElement.hasAttribute('data-expanding')).toBe(false)
  })

  it('stays marked until the latest hold ends when another row starts to expand', () => {
    vi.useFakeTimers()
    holdScrollAnchor()
    vi.advanceTimersByTime(EXPAND_MS)
    holdScrollAnchor()
    vi.advanceTimersByTime(EXPAND_MS)
    expect(document.documentElement.hasAttribute('data-expanding')).toBe(true)
    vi.advanceTimersByTime(100)
    expect(document.documentElement.hasAttribute('data-expanding')).toBe(false)
  })

  it('has a rule in the theme that switches scroll anchoring off on the page and its body while marked', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')
    expect(css).toMatch(/html\[data-expanding\][^{]*body[^{]*\{[^}]*overflow-anchor:\s*none/)
  })
})
