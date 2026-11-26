import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  contrast,
  hexToRgb,
  hslToRgb,
  hueAt,
  layerStyles,
  moduleHues,
  paint,
  typeStyles,
} from './style.mjs'

const theme = fs.readFileSync('src/themes/default/theme.css', 'utf8')
const tokenOf = (block, name) =>
  theme.split(block)[1].match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1]
const backgrounds = {
  light: hexToRgb(tokenOf("[data-theme='light']", 'background')),
  dark: hexToRgb(tokenOf("[data-theme='dark']", 'background')),
}

const rgbOf = (hue, dark) => {
  const [h, s, l] = paint(hue, dark)
    .match(/[\d.]+/g)
    .map(Number)
  return hslToRgb(h, s / 100, l / 100)
}

describe('style (#1463)', () => {
  it('gives every node type its own shape-and-hue pair, and keeps it across runs', () => {
    const types = Object.fromEntries(
      ['site', 'module', 'collection', 'endpoint', 'skill', 'other', 'more'].map((t) => [
        t,
        { group: 'x', what: '' },
      ]),
    )
    const styles = typeStyles(types)
    const pairs = Object.values(styles).map((s) => `${s.shape}/${s.hue.toFixed(2)}`)
    expect(new Set(pairs).size).toBe(pairs.length)
    expect(typeStyles(types)).toEqual(styles)
    expect(styles.endpoint.shape).toBe('hexagon')
  })

  it('gives every layer a hue and one of three line styles, so neighbours differ', () => {
    const styles = layerStyles([{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }])
    expect(styles.a.dash).toEqual([])
    expect(styles.b.dash).not.toEqual(styles.a.dash)
    expect(styles.c.dash).not.toEqual(styles.b.dash)
    expect(styles.d.dash).toEqual(styles.a.dash)
    expect(new Set(Object.values(styles).map((s) => s.hue)).size).toBe(4)
  })

  it('gives each module a hue', () => {
    expect(Object.keys(moduleHues(['module:a', 'module:b']))).toEqual(['module:a', 'module:b'])
  })

  for (const mode of ['light', 'dark']) {
    it(`keeps every node, line and module colour at 3:1 or more on the ${mode} page (WCAG 1.4.11)`, () => {
      for (let i = 0; i < 60; i++) {
        for (const offset of [20, 80, 200]) {
          expect(
            contrast(rgbOf(hueAt(i, offset), mode === 'dark'), backgrounds[mode]),
          ).toBeGreaterThanOrEqual(3)
        }
      }
    })
  }

  const TEXT_PAIRS = [
    ['foreground', 'background'],
    ['foreground', 'card'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'card'],
    ['primary-strong', 'card'],
    ['primary-strong', 'background'],
    ['primary-foreground', 'primary-fill'],
    ['destructive-strong', 'card'],
    ['warning-strong', 'background'],
  ]
  for (const mode of ['light', 'dark']) {
    it(`keeps the page\u2019s text colours at 4.5:1 or more in ${mode} (WCAG 1.4.3)`, () => {
      for (const [fg, bg] of TEXT_PAIRS) {
        const block = `[data-theme='${mode}']`
        expect(
          contrast(hexToRgb(tokenOf(block, fg)), hexToRgb(tokenOf(block, bg))),
          `${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})
