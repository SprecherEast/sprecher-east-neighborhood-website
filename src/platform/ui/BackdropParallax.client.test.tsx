// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BackdropParallax } from './BackdropParallax.client'
import { stubMatchMedia } from './testing/stubMatchMedia'

const reduced = stubMatchMedia

const frames: FrameRequestCallback[] = []

const scrollTo = (y: number, pageHeight = 3000, screenHeight = 1000) => {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: pageHeight,
    configurable: true,
  })
  Object.defineProperty(window, 'innerHeight', { value: screenHeight, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  act(() => {
    window.dispatchEvent(new Event('scroll'))
    // The frame the scroll asked for
    frames.splice(0).forEach((callback) => callback(0))
  })
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const mover = (container: HTMLElement) => container.firstElementChild as HTMLElement

describe('BackdropParallax', () => {
  it('draws its children in one box that moves, and nothing else', () => {
    reduced(false)
    const { container } = render(
      <BackdropParallax>
        <i>photo</i>
      </BackdropParallax>,
    )

    expect(mover(container).hasAttribute('data-backdrop-parallax')).toBe(true)
    expect(mover(container).textContent).toBe('photo')
  })

  it('drifts the photo down the screen as the page scrolls: down at the top, up at the foot', () => {
    reduced(false)
    const { container } = render(<BackdropParallax>{null}</BackdropParallax>)

    scrollTo(0)
    expect(mover(container).style.transform).toBe('translate3d(0, 7%, 0)')
    scrollTo(1000) // halfway: 1000 of the 2000 a page can scroll
    expect(mover(container).style.transform).toBe('translate3d(0, 0%, 0)')
    scrollTo(2000)
    expect(mover(container).style.transform).toBe('translate3d(0, -7%, 0)')
  })

  it('stays still for a page that does not scroll', () => {
    reduced(false)
    const { container } = render(<BackdropParallax>{null}</BackdropParallax>)

    scrollTo(0, 800, 1000)
    expect(mover(container).style.transform).toBe('translate3d(0, 0%, 0)')
  })

  it('starts where the top of the page puts it, so nothing jumps when the script starts', () => {
    reduced(false)
    const { container } = render(<BackdropParallax>{null}</BackdropParallax>)

    expect(mover(container).className).toContain('h-[118%]')
    expect(mover(container).className).toContain('-top-[9%]')
    scrollTo(0)
    expect(mover(container).style.transform).toBe('translate3d(0, 7%, 0)')
  })

  it('does not move at all when the visitor asks for reduced motion', () => {
    reduced(true)
    const add = vi.spyOn(window, 'addEventListener')
    const { container } = render(<BackdropParallax>{null}</BackdropParallax>)

    scrollTo(1500)
    // Still, where the top of the page puts it
    expect(mover(container).style.transform).toBe('translate3d(0, 7%, 0)')
    expect(add).not.toHaveBeenCalledWith('scroll', expect.anything(), expect.anything())
  })

  it('stops listening when the page goes away', () => {
    reduced(false)
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<BackdropParallax>{null}</BackdropParallax>)

    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
