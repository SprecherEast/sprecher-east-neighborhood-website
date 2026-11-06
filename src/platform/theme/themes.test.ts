import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CHART_PAIRS,
  CONTRAST_PAIRS,
  MIN_GRAPHIC_CONTRAST,
  MIN_TEXT_CONTRAST,
  THEME_TOKENS,
  THEME_TOKEN_NAMES,
  SCRIM_PAIRS,
  TINTED_PAIRS,
} from './tokens'
import { contrastRatio, mixOver, readThemeModes } from './themeFile'

const THEMES_DIR = join(process.cwd(), 'src/themes')
const themes = readdirSync(THEMES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

describe('theme files', () => {
  it('has the default theme', () => {
    expect(themes).toContain('default')
  })

  describe.each(themes)('%s', (theme) => {
    const modes = readThemeModes(readFileSync(join(THEMES_DIR, theme, 'theme.css'), 'utf8'))

    it.each(THEME_TOKEN_NAMES)('defines --%s in light mode', (token) => {
      expect(modes.light[token], `--${token} is missing in light mode`).toBeDefined()
    })

    it.each(THEME_TOKEN_NAMES.filter((token) => THEME_TOKENS[token].modes === 'both'))(
      'defines --%s in dark mode',
      (token) => {
        expect(modes.darkOwn[token], `--${token} is missing in dark mode`).toBeDefined()
      },
    )

    it('keeps the diagram marker orange the same in both modes (it matches the artwork)', () => {
      // The numbered markers drawn into a diagram image are one fixed orange; the legend's circles
      // must match them in dark mode too, where the accent turns lighter (#658)
      expect(modes.light['diagram-marker']).toBe('#e8923a')
      expect(modes.darkOwn['diagram-marker']).toBeUndefined()
      expect(modes.dark['diagram-marker']).toBe(modes.light['diagram-marker'])
    })

    describe.each(['light', 'dark'] as const)('%s mode contrast', (mode) => {
      it.each(CONTRAST_PAIRS)('%s on %s passes WCAG AA', (text, background) => {
        const ratio = contrastRatio(modes[mode][text], modes[mode][background])
        expect(ratio, `--${text} on --${background}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        )
      })

      it.each(CHART_PAIRS)('%s on %s passes 3:1 for graphics', (chart, background) => {
        const ratio = contrastRatio(modes[mode][chart], modes[mode][background])
        expect(
          ratio,
          `--${chart} on --${background}: ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST)
      })

      it.each([...TINTED_PAIRS, ...SCRIM_PAIRS])(
        '%s on a %s tint over %s (opacity %s) passes WCAG AA',
        (text, tint, background, alpha) => {
          const tinted = mixOver(modes[mode][tint], modes[mode][background], alpha)
          const ratio = contrastRatio(modes[mode][text], tinted)
          expect(
            ratio,
            `--${text} on --${tint} over --${background}: ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
        },
      )
    })
  })
})

describe('readThemeModes', () => {
  const css = `:root,\n[data-theme='light'] {\n  --a: #ffffff;\n  --b: #000000;\n}\n[data-theme='dark'] {\n  --a: #111111; /* note */\n}\n`

  it('reads light values and lets dark inherit what it leaves out', () => {
    const modes = readThemeModes(css)
    expect(modes.light).toEqual({ a: '#ffffff', b: '#000000' })
    expect(modes.dark).toEqual({ a: '#111111', b: '#000000' })
    expect(modes.darkOwn).toEqual({ a: '#111111' })
  })

  it('fails when a mode block is missing', () => {
    expect(() => readThemeModes(":root, [data-theme='light'] { --a: #fff; }")).toThrow(/dark/)
    expect(() => readThemeModes("[data-theme='dark'] { --a: #fff; }")).toThrow(/light/)
  })

  it('ignores a commented-out mode block', () => {
    const light = ":root, [data-theme='light'] { --a: #fff; }\n"
    expect(() => readThemeModes(`${light}/*\n[data-theme='dark'] { --a: #000; }\n*/\n`)).toThrow(
      /dark/,
    )
    expect(() => readThemeModes(`/* ${light} */\n[data-theme='dark'] { --a: #000; }\n`)).toThrow(
      /light/,
    )
  })
})

describe('mixOver', () => {
  it('paints a colour at an opacity over a background, as the browser composites it', () => {
    expect(mixOver('#000000', '#ffffff', 0)).toBe('#ffffff')
    expect(mixOver('#000000', '#ffffff', 1)).toBe('#000000')
    expect(mixOver('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixOver('#dc2626', '#f0ede6', 0.1)).toBe('#eed9d3')
  })
})

describe('contrastRatio', () => {
  it('matches the WCAG formula', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  it('refuses a value it cannot measure', () => {
    expect(() => contrastRatio('var(--x)', '#ffffff')).toThrow(/hex/)
  })
})
