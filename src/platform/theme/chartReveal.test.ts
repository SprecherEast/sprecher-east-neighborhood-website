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
