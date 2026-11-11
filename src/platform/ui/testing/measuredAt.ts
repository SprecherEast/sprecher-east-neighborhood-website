import { vi } from 'vitest'

/**
 * Makes every element measure this many pixels wide, as a browser would, for a component that
 * draws from its own width (`useElementWidth`). Call it inside a test, then render.
 */
export function measuredAt(width: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 100,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 100,
    toJSON: () => ({}),
  })
}
