import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FIGURE_GAP,
  HERO_MIN_HEIGHT,
  LEGEND_HANG,
  LEGEND_TUCK,
  PAGE_MIN_HEIGHT,
  PAGE_SHELL,
  READING_GRID,
  READING_WIDTH,
  READING_WIDTH_LG,
} from './layoutSizes'

const globalsCss = readFileSync(join(process.cwd(), 'src/app/(frontend)/globals.css'), 'utf8')

describe('layout sizes', () => {
  it('read one variable each, so a size is defined in one place', () => {
    expect(READING_WIDTH).toBe('max-w-[var(--reading-width)]')
    expect(PAGE_SHELL).toBe('py-24')
    expect(READING_WIDTH_LG).toBe('lg:max-w-[var(--reading-width)]')
    expect(READING_GRID).toBe('lg:grid-cols-[1fr_var(--reading-width)_1fr]')
    expect(PAGE_MIN_HEIGHT).toBe('min-h-[var(--page-min-height)]')
    expect(HERO_MIN_HEIGHT).toBe('min-h-[var(--hero-min-height)]')
    expect(FIGURE_GAP).toBe('my-[var(--figure-gap)]')
    expect(LEGEND_HANG).toBe('-mt-[calc(var(--figure-gap)+var(--legend-overlap))]')
    expect(LEGEND_TUCK).toBe('pt-[calc(var(--legend-overlap)+1rem)]')
  })

  it('are defined in globals.css, once each', () => {
    for (const name of [
      '--reading-width',
      '--page-min-height',
      '--hero-min-height',
      '--figure-gap',
      '--legend-overlap',
    ]) {
      const definitions = globalsCss.match(new RegExp(`^\\s*${name}:`, 'gm')) ?? []
      expect(definitions, name).toHaveLength(1)
    }
  })
})
