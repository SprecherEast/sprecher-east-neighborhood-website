// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  GLASS_SCRIM_ALPHA,
  GLASS_SHEEN_ALPHA,
  GLASS_TINT_ALPHA,
  MIN_TEXT_CONTRAST,
} from '@/platform/theme/tokens'
import { contrastRatio, mixOver, readThemeModes } from '@/platform/theme/themeFile'

import { GlassPanel } from './GlassPanel'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const modes = readThemeModes(
  readFileSync(join(process.cwd(), 'src/themes/default/theme.css'), 'utf8'),
)

describe('GlassPanel', () => {
  it('holds its content in the hero glass: radius, border, blur, tint, sheen and edge glow', () => {
    const { container } = render(<GlassPanel>Unofficial site</GlassPanel>)
    const panel = container.firstElementChild as HTMLElement

    expect(screen.getByText('Unofficial site')).toBeTruthy()
    for (const glass of [
      'rounded-xl',
      'border-on-image/20',
      'backdrop-blur-xl',
      'text-on-image',
      'overflow-hidden',
    ]) {
      expect(panel.className).toContain(glass)
    }
    expect(panel.innerHTML).toContain('bg-on-image/10')
    expect(panel.innerHTML).toContain('from-on-image/15 via-transparent to-on-image/5')
    expect(panel.innerHTML).toContain('via-on-image/40')
  })

  // The rail's text plates leave glass alone (#1268), so it keeps the photo behind it
  it('marks itself, so a plate around its neighbours skips it', () => {
    const { container } = render(<GlassPanel>Text</GlassPanel>)
    expect(container.firstElementChild?.hasAttribute('data-glass-panel')).toBe(true)
  })

  it('takes layout classes only, and keeps the glass', () => {
    const { container } = render(<GlassPanel className="mt-3">Text</GlassPanel>)
    const panel = container.firstElementChild as HTMLElement
    expect(panel.className).toContain('mt-3')
    expect(panel.className).toContain('backdrop-blur-xl')
  })

  it('draws its darkening layer from the scrim token, at the strength the contrast test uses', () => {
    const { container } = render(<GlassPanel>Text</GlassPanel>)
    const layer = container.querySelector('.bg-scrim\\/80')
    expect(layer).toBeTruthy()
    expect(GLASS_SCRIM_ALPHA).toBe(0.8)
    expect(container.innerHTML).toContain(`bg-on-image/${GLASS_TINT_ALPHA * 100}`)
    expect(container.innerHTML).toContain(`from-on-image/${GLASS_SHEEN_ALPHA * 100}`)
  })

  it('uses no literal colours', () => {
    const { container } = render(<GlassPanel>Text</GlassPanel>)
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|(?:white|black)\b/i)
  })

  it.each(['light', 'dark'] as const)(
    'keeps its text at 4.5:1 or better over white, a mid shade and black in %s mode',
    (mode) => {
      const { 'on-image': onImage, scrim } = modes[mode]
      for (const behind of ['#ffffff', '#808080', '#000000']) {
        // The layer, then the tint, then the sheen at its strongest: the lightest the glass gets
        let glass = mixOver(scrim, behind, GLASS_SCRIM_ALPHA)
        glass = mixOver(onImage, glass, GLASS_TINT_ALPHA)
        glass = mixOver(onImage, glass, GLASS_SHEEN_ALPHA)
        // Full text, and the 90% text the hero sets
        for (const text of [onImage, mixOver(onImage, glass, 0.9)]) {
          const ratio = contrastRatio(text, glass)
          expect(
            ratio,
            `${text} on ${glass} over ${behind}: ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
        }
      }
    },
  )

  it('would fail without the layer, so the check means something', () => {
    const glass = mixOver(
      modes.light['on-image'],
      mixOver(modes.light['on-image'], '#ffffff', 0.1),
      0.15,
    )
    expect(contrastRatio(modes.light['on-image'], glass)).toBeLessThan(MIN_TEXT_CONTRAST)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <main>
        <GlassPanel>
          <p>Unofficial site</p>
        </GlassPanel>
      </main>,
    )
    await expectAccessible(container)
  })
})
