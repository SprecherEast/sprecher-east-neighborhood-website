// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Disclosure } from './Disclosure'
import { EXPAND_MS } from './motion.client'

afterEach(cleanup)

describe('Disclosure expanding (#1170)', () => {
  it('listRow expands over the shared time, from the theme, and the others keep opening at once', () => {
    render(
      <Disclosure variant="listRow" summary="More">
        Body
      </Disclosure>,
    )
    render(
      <Disclosure variant="card" summary="Card">
        Body
      </Disclosure>,
    )
    const [listRow, card] = screen.getAllByRole('group') as HTMLElement[]
    expect(listRow.className).toContain('disclosure-expand')
    expect(card.className).not.toContain('disclosure-expand')
    const css = readFileSync(resolve(process.cwd(), 'src/platform/theme/expand.css'), 'utf8')
    const block = /@utility disclosure-expand[\s\S]*?\n\}/.exec(css)?.[0] ?? ''
    expect(block).toContain('::details-content')
    expect(block).toContain('prefers-reduced-motion: no-preference')
    expect(Number(/transition:\s*height\s+([\d.]+)ms/.exec(block)?.[1])).toBe(EXPAND_MS)
  })

  it('scrolls a box a reader opened into view once its expansion ends, not before', () => {
    vi.useFakeTimers()
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transitionDuration: `${EXPAND_MS / 1000}s`,
    } as CSSStyleDeclaration)
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0))
    render(
      <Disclosure variant="listRow" summary="More">
        Body
      </Disclosure>,
    )
    const group = screen.getByRole('group') as HTMLDetailsElement
    fireEvent.click(screen.getByText('More'))
    group.open = true
    vi.advanceTimersByTime(EXPAND_MS - 1)
    expect(scroll).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(scroll).toHaveBeenCalledTimes(1)
    spy.mockRestore()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})
