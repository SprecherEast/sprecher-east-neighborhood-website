import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MIN_TEXT_CONTRAST } from '@/platform/theme/tokens'
import { contrastRatio, mixOver, readThemeModes } from '@/platform/theme/themeFile'

import { SHARE_TONES } from './shareTones'

const modes = readThemeModes(
  readFileSync(join(process.cwd(), 'src/themes/default/theme.css'), 'utf8'),
)

/** A tone's fill class (`fill-muted-foreground/45`) as the color it paints over the card */
function paintedFill(mode: 'light' | 'dark', fill: string): string {
  const [, token = '', alpha] = /^fill-(.+?)(?:\/(\d+))?$/.exec(fill) ?? []
  return mixOver(modes[mode][token] ?? '', modes[mode].card ?? '', alpha ? Number(alpha) / 100 : 1)
}

describe('SHARE_TONES', () => {
  it('draws the highlighted slice in the primary green, solid, in the bar and the receipt square', () => {
    expect(SHARE_TONES.highlight.fill).toBe('fill-primary-fill')
    expect(SHARE_TONES.highlight.swatch).toBe('bg-primary-fill')
  })

  it('draws the other slices in neutral tones of three different lightness', () => {
    const fills = [SHARE_TONES.strong, SHARE_TONES.medium, SHARE_TONES.light].map((t) => t.fill)
    expect(new Set(fills).size).toBe(3)
    for (const fill of fills) expect(fill).toContain('muted-foreground')
  })

  it('gives only the highlighted slice a receipt row of its own: a soft primary fill and bolder text', () => {
    expect(SHARE_TONES.highlight.row).toContain('bg-primary/10')
    expect(SHARE_TONES.highlight.row).toContain('font-semibold')
    for (const tone of [SHARE_TONES.strong, SHARE_TONES.medium, SHARE_TONES.light]) {
      expect(tone.row).toBe('')
    }
  })

  describe.each(['light', 'dark'] as const)('%s mode', (mode) => {
    it.each(Object.entries(SHARE_TONES))(
      'writes the %s slice’s percent at 4.5:1 or better',
      (_name, tone) => {
        const text = /^fill-(.+)$/.exec(tone.label)?.[1] ?? ''
        const ratio = contrastRatio(modes[mode][text] ?? '', paintedFill(mode, tone.fill))
        expect(
          ratio,
          `${tone.label} on ${tone.fill}: ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      },
    )
  })
})
