import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// The chart wipe (#639) clips a grid to nothing until it scrolls into view. A printed page never
// scrolls, so the wipe must be a screen-only effect: print and every other medium draw the grid
// in full.
const css = readFileSync(join(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')
const utility = css.slice(css.indexOf('@utility chart-reveal'))

describe('chart-reveal', () => {
  it('only animates on screen, where the reader allows motion', () => {
    expect(utility).toMatch(
      /@utility chart-reveal \{\s*@media screen and \(prefers-reduced-motion: no-preference\)/,
    )
  })

  it('needs scroll-driven animation support', () => {
    expect(utility).toContain('@supports (animation-timeline: view())')
  })
})

// `chart-reveal-x` (#663) draws a bar chart's bars out from the baseline as they scroll into view,
// under the same conditions: screen only, motion allowed, scroll-driven animation supported.
const bars = css.slice(css.indexOf('@utility chart-reveal-x'))

describe('chart-reveal-x', () => {
  it('only animates on screen, where the reader allows motion', () => {
    expect(bars).toMatch(
      /@utility chart-reveal-x \{\s*@media screen and \(prefers-reduced-motion: no-preference\)/,
    )
  })

  it('needs scroll-driven animation support, so other browsers show the finished bars', () => {
    expect(bars).toContain('@supports (animation-timeline: view())')
  })

  it('grows from the baseline (the left edge of the bars), not from the middle', () => {
    expect(bars).toContain('transform-box: fill-box')
    expect(bars).toMatch(/transform-origin: left/)
    expect(css).toMatch(/@keyframes chart-reveal-x \{\s*from \{\s*transform: scaleX\(0\)/)
  })
})
