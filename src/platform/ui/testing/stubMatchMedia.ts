import { vi } from 'vitest'

/**
 * jsdom has no `matchMedia`. Stubs it so every query answers `matches` (`false`: no preference, no
 * match; `true`: for example reduced motion asked for). Vitest puts the real thing back after the
 * test (`unstubGlobals`), so call it in each test or `beforeEach` that renders what asks.
 */
export function stubMatchMedia(matches = false) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}
