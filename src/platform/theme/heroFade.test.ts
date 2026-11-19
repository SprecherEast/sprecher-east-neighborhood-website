import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')
const fade = css.slice(css.indexOf('@utility hero-fade'))
const geometry = css.slice(css.indexOf('@utility hero-geometry'), css.indexOf('@utility hero-fade'))

describe('hero-fade (#1304)', () => {
  const stops = [...fade.matchAll(/(\d+(?:\.\d+)?)%, transparent\) (\d+)%/g)].map((m) => ({
    strength: Number(m[1]),
    at: Number(m[2]),
  }))

  it('follows the smoothstep curve, so the photo neither starts nor stops with an edge', () => {
    expect(stops.length).toBeGreaterThanOrEqual(9)
    for (const { strength, at } of stops) {
      const t = at / 100
      expect(strength).toBeCloseTo((3 * t * t - 2 * t * t * t) * 100, 0)
    }
  })

  it('runs from clear to the solid page colour, in page tokens only', () => {
    expect(fade).toMatch(/to bottom,\s*transparent 0%/)
    expect(fade).toContain('var(--color-background) 100%')
    expect(fade).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i)
  })
})

describe('hero-geometry (#1304)', () => {
  it("makes the hero a size container and works the photo's height and the horizon out of its width", () => {
    expect(geometry).toContain('container-type: inline-size')
    expect(geometry).toContain('--hero-photo-h: max(calc(100cqw / var(--hero-aspect))')
    expect(geometry).toContain('--hero-horizon: calc(var(--hero-focal-y) * var(--hero-photo-h))')
  })

  it('has its own least height from md and from lg, where the title and the buttons change', () => {
    expect(geometry).toMatch(/@media \(width >= 48rem\)[\s\S]*var\(--hero-photo-min-md\)/)
    expect(geometry).toMatch(/@media \(width >= 64rem\)[\s\S]*var\(--hero-photo-min-lg\)/)
  })
})
