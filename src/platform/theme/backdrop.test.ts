import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { BACKDROP_SCRIM_ALPHA } from './tokens'

// What a page with a photo behind it shares (#1268): one title glow, one soft-edged text plate and
// one fade, written once in the theme layer so no page writes its own
const css = readFileSync(join(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')

const block = (start: string) => {
  const from = css.indexOf(start)
  expect(from, `${start} is missing from tailwind.css`).toBeGreaterThan(-1)
  return css.slice(from, css.indexOf('\n}', from) + 2)
}

describe('the backdrop utilities', () => {
  it('has a variant for what sits on a page with a backdrop, so no class repeats the check', () => {
    expect(css).toContain('@custom-variant on-photo (&:where([data-backdrop] *))')
  })

  it('has one title glow: four soft layers in the page colour, from about 2rem to 14rem', () => {
    const glow = block('--text-shadow-glow:')
    const layers = [...glow.matchAll(/0 0 (\d+(?:\.\d+)?)rem/g)].map((m) => Number(m[1]))
    expect(layers).toEqual([2, 5, 9, 14])
    expect(glow).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i)
    expect(glow.match(/var\(--background\)/g)?.length).toBe(4)
  })

  it('has a text plate that is page colour with a soft edge, only over a backdrop', () => {
    const plate = block('@utility text-plate')
    expect(plate).toContain('[data-backdrop] *')
    // Width is the caller's: `lg:text-plate` for a column, bare for a title
    expect(plate).not.toContain('@media')
    expect(plate).toContain('background: var(--background)')
    expect(plate).toContain('box-shadow')
    expect(plate).toContain('var(--plate-bleed')
    // A plate inside a plain page changes nothing
    expect(plate.indexOf('position: relative')).toBeGreaterThan(plate.indexOf('[data-backdrop] *'))
  })

  it('has a fade: solid page colour that thins out at the foot, over a backdrop only', () => {
    const fade = block('@utility text-fade')
    expect(fade).toContain('[data-backdrop] *')
    expect(fade).toMatch(/linear-gradient\(\s*to bottom,\s*var\(--background\)/)
    expect(fade).toContain('transparent')
    // The fade is room under the text, so no line of text sits on the thinning part
    expect(fade).toContain('padding-bottom: var(--plate-fade, 7rem)')
  })

  it('keeps the scrim faint where there is no text', () => {
    expect(BACKDROP_SCRIM_ALPHA.light).toBeLessThanOrEqual(0.1)
    expect(BACKDROP_SCRIM_ALPHA.dark).toBeLessThanOrEqual(0.15)
    expect(BACKDROP_SCRIM_ALPHA.dark).toBeGreaterThan(BACKDROP_SCRIM_ALPHA.light)
  })
})
