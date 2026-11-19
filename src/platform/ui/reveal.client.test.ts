// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { REVEAL_PEEK_VAR } from './scrollMargin'
import { REVEAL_ANCHOR_ATTR, revealAfterExpansion, revealOpened } from './reveal.client'

const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top }) as DOMRect

// jsdom has no layout: edges, margins and the scroll are all stood in for
function setUp({ anchor = true, transition = '0s' } = {}) {
  const details = document.createElement('details')
  details.open = true
  const heading = document.createElement('p')
  heading.id = 'bill-heading'
  document.body.append(heading, details)
  if (anchor) details.setAttribute(REVEAL_ANCHOR_ATTR, 'bill-heading')
  details.scrollIntoView = vi.fn()
  window.scrollBy = vi.fn() as unknown as typeof window.scrollBy
  vi.stubGlobal('innerHeight', 800)
  const real = window.getComputedStyle.bind(window)
  vi.stubGlobal('getComputedStyle', (el: Element, pseudo?: string | null) =>
    el === details && !pseudo
      ? ({ scrollMarginTop: '80px', scrollMarginBottom: '16px' } as CSSStyleDeclaration)
      : pseudo
        ? ({ transitionDuration: transition } as CSSStyleDeclaration)
        : real(el),
  )
  return { details, heading }
}

describe('revealOpened (#1178)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('keeps the row’s own top and end rule when it names no anchor', () => {
    const { details } = setUp({ anchor: false })
    revealOpened(details)
    expect(details.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect(window.scrollBy).not.toHaveBeenCalled()
  })

  it('scrolls so the end shows and the named anchor stays under the sticky header', () => {
    const { details, heading } = setUp()
    heading.getBoundingClientRect = () => rect(200, 230)
    details.getBoundingClientRect = () => rect(300, 1400)
    revealOpened(details)
    // The end is 1400 + 16 - 800 = 616 down, but the anchor may only move 200 - 80 = 120
    expect(window.scrollBy).toHaveBeenCalledWith({ top: 120 })
    expect(details.scrollIntoView).not.toHaveBeenCalled()
  })

  it('moves nothing when the end shows and the anchor is clear', () => {
    const { details, heading } = setUp()
    heading.getBoundingClientRect = () => rect(200, 230)
    details.getBoundingClientRect = () => rect(300, 600)
    revealOpened(details)
    expect(window.scrollBy).not.toHaveBeenCalled()
  })

  it('falls back to the row’s rule when the named anchor is not on the page', () => {
    const { details, heading } = setUp()
    heading.remove()
    revealOpened(details)
    expect(details.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('keeps room for the box under it, as before (#1154)', () => {
    const { details } = setUp({ anchor: false })
    const next = document.createElement('details')
    const summary = document.createElement('summary')
    next.append(summary)
    details.after(next)
    details.getBoundingClientRect = () => rect(0, 100)
    summary.getBoundingClientRect = () => rect(110, 150)
    revealOpened(details)
    expect(details.style.getPropertyValue(REVEAL_PEEK_VAR)).toBe('70px')
  })
})

describe('revealAfterExpansion (#1170, #1178)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('waits for the expansion to end before scrolling', () => {
    const { details } = setUp({ anchor: false, transition: '500ms' })
    revealAfterExpansion(details)
    vi.advanceTimersByTime(499)
    expect(details.scrollIntoView).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(details.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('scrolls at once when the row opens without an expansion', () => {
    const { details } = setUp({ anchor: false, transition: '0s' })
    revealAfterExpansion(details)
    expect(details.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the row was closed again meanwhile', () => {
    const { details } = setUp({ anchor: false, transition: '500ms' })
    revealAfterExpansion(details)
    details.open = false
    vi.advanceTimersByTime(600)
    expect(details.scrollIntoView).not.toHaveBeenCalled()
  })
})
