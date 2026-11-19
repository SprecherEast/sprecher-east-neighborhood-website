// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { GLASS_SCRIM_ALPHA, GLASS_SHEEN_ALPHA, MIN_TEXT_CONTRAST } from '@/platform/theme/tokens'
import { contrastRatio, mixOver, readThemeModes } from '@/platform/theme/themeFile'

import { GlassPanel } from './GlassPanel'
import { expectAccessible } from './testing/expectAccessible'

afterEach(cleanup)

const BRIGHT_PHOTO = '#d0d0d0'

const modes = readThemeModes(
  readFileSync(join(process.cwd(), 'src/themes/default/theme.css'), 'utf8'),
)

describe('GlassPanel', () => {
  it('holds its content in the hero glass: radius, border, blur, sheen and edge glow, with no white wash', () => {
    const { container } = render(<GlassPanel>Unofficial site</GlassPanel>)
    const panel = container.firstElementChild as HTMLElement

    expect(screen.getByText('Unofficial site')).toBeTruthy()
    for (const glass of [
      'rounded-xl',
      'border-on-image/20',
      'backdrop-blur-xl',
      'backdrop-saturate-150',
      'text-on-image',
      'overflow-hidden',
    ]) {
      expect(panel.className).toContain(glass)
    }
    // A flat white layer over the dark one is what made the panel read as gray (#1292)
    expect(panel.innerHTML).not.toMatch(/(?<![-\w])bg-on-image\//)
    expect(panel.innerHTML).toContain('from-on-image/6 via-transparent to-transparent')
    expect(panel.innerHTML).toContain('via-on-image/40')
  })

  it('takes layout classes only, and keeps the glass', () => {
    const { container } = render(<GlassPanel className="mt-3">Text</GlassPanel>)
    const panel = container.firstElementChild as HTMLElement
    expect(panel.className).toContain('mt-3')
    expect(panel.className).toContain('backdrop-blur-xl')
  })

  it('draws its darkening layer from the scrim token, at the strength the contrast test uses', () => {
    const { container } = render(<GlassPanel>Text</GlassPanel>)
    const layer = container.querySelector('.bg-scrim\\/55')
    expect(layer).toBeTruthy()
    expect(GLASS_SCRIM_ALPHA).toBe(0.55)
    expect(container.innerHTML).toContain(`from-on-image/${GLASS_SHEEN_ALPHA * 100}`)
  })

  it('uses no literal colours', () => {
    const { container } = render(<GlassPanel>Text</GlassPanel>)
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|(?:white|black)\b/i)
  })

  it.each(['light', 'dark'] as const)(
    'keeps its text at 4.5:1 or better over a very bright photo, a mid shade and black in %s mode',
    (mode) => {
      const { 'on-image': onImage, scrim } = modes[mode]
      // The brightest photo the glass is guaranteed over: lighter than anything behind the home hero's
      // note (measured 2026-11-18, the lightest spot after the blur is about #cfcfcf). A pure white
      // photo is no longer guaranteed (#1301).
      for (const behind of [BRIGHT_PHOTO, '#808080', '#000000']) {
        // The layer, then the sheen at its strongest: the lightest the glass gets
        let glass = mixOver(scrim, behind, GLASS_SCRIM_ALPHA)
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
    const glass = mixOver(modes.light['on-image'], BRIGHT_PHOTO, GLASS_SHEEN_ALPHA)
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
