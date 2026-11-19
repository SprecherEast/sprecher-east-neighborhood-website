import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CHART_LARGE_WIDTH,
  CHART_SMALL_WIDTH,
  FIGURE_GAP,
  HERO_BELOW_GAP,
  HERO_BOTTOM_SPACE,
  HERO_FADE_LENGTH,
  HERO_HORIZON_GAP,
  HERO_PHOTO_HEIGHT,
  HERO_PHOTO_LAYER_BOTTOM,
  HERO_SKY_GAP,
  HERO_SKY_HEIGHT,
  LEGEND_GAP,
  PAGE_MIN_HEIGHT,
  PAGE_SHELL,
  READING_WIDTH,
  SHARED_ROWS_SPACE_4,
  SUBGRID_FOUR_ROWS,
  SUBGRID_THREE_ROWS,
  READING_WIDTH_LG,
} from './layoutSizes'

const globalsCss = readFileSync(join(process.cwd(), 'src/app/(frontend)/globals.css'), 'utf8')

describe('layout sizes', () => {
  it('read one variable each, so a size is defined in one place', () => {
    expect(READING_WIDTH).toBe('max-w-[var(--reading-width)]')
    expect(PAGE_SHELL).toBe('py-24')
    expect(READING_WIDTH_LG).toBe('lg:max-w-[var(--reading-width)]')
    expect(PAGE_MIN_HEIGHT).toBe('min-h-[var(--page-min-height)]')
    expect(HERO_PHOTO_HEIGHT).toBe('h-[var(--hero-photo-h)] min-h-full')
    expect(HERO_SKY_HEIGHT).toBe(
      'min-h-[max(0px,calc(var(--hero-horizon)_-_var(--header-height)))]',
    )
    expect(HERO_SKY_GAP).toBe('pb-[var(--hero-sky-gap)]')
    expect(HERO_HORIZON_GAP).toBe('mt-[var(--hero-horizon-gap)]')
    expect(HERO_BOTTOM_SPACE).toBe('pb-[var(--hero-bottom-space)]')
    expect(HERO_BELOW_GAP).toBe('mb-[var(--hero-below-gap)]')
    expect(HERO_PHOTO_LAYER_BOTTOM).toBe('bottom-[calc(var(--hero-fade-overlap)*-1)]')
    expect(HERO_FADE_LENGTH).toBe('h-[var(--hero-fade-length)]')
    expect(CHART_SMALL_WIDTH).toBe(
      'max-w-[var(--chart-stack-width)] @2xl/chart:max-w-[var(--chart-small-width)]',
    )
    expect(CHART_LARGE_WIDTH).toContain('max-w-[var(--chart-large-width)]')
    expect(FIGURE_GAP).toBe('my-[var(--figure-gap)]')
    expect(LEGEND_GAP).toBe('-mt-[calc(var(--figure-gap)_-_var(--legend-gap))]')
  })

  it('share their rows by subgrid: one count in both classes, one fewer for the facts (#678)', () => {
    const rows = 4
    expect(SUBGRID_FOUR_ROWS).toContain(`row-span-${rows} `)
    // The foot is the last row, so the facts above it span one fewer
    expect(SUBGRID_THREE_ROWS).toContain(`row-span-${rows - 1} `)
    for (const classes of [SUBGRID_FOUR_ROWS, SUBGRID_THREE_ROWS]) {
      expect(classes).toContain('grid grid-rows-subgrid')
    }
  })

  it('keep the rows of cards that share them apart by a margin the list takes back', () => {
    // The margin equals the gap it replaces: gap-4 for a `CardGrid` gap="sm"
    expect(SHARED_ROWS_SPACE_4).toEqual({ item: 'mb-4', list: '-mb-4 gap-y-0' })
  })

  it('are defined in globals.css, once each', () => {
    for (const name of [
      '--reading-width',
      '--page-min-height',
      '--hero-photo-min',
      '--hero-photo-min-md',
      '--hero-photo-min-lg',
      '--hero-sky-gap',
      '--hero-horizon-gap',
      '--hero-bottom-space',
      '--hero-below-gap',
      '--hero-fade-length',
      '--hero-fade-overlap',
      '--figure-gap',
      '--legend-gap',
      '--chart-small-width',
      '--chart-stack-width',
      '--chart-large-width',
    ]) {
      const definitions = globalsCss.match(new RegExp(`^\\s*${name}:`, 'gm')) ?? []
      expect(definitions, name).toHaveLength(1)
    }
  })
})
