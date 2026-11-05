import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CHART_LARGE_WIDTH,
  CHART_SMALL_WIDTH,
  FIGURE_GAP,
  HERO_MIN_HEIGHT,
  LEGEND_HANG,
  LEGEND_TUCK,
  PAGE_MIN_HEIGHT,
  PAGE_SHELL,
  READING_GRID,
  READING_WIDTH,
  SHARED_ROWS_SPACE_2,
  SHARED_ROWS_SPACE_4,
  SUBGRID_FOUR_ROWS,
  SUBGRID_FOUR_ROWS_EXPLICIT,
  SUBGRID_THREE_ROWS,
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
    expect(CHART_SMALL_WIDTH).toBe('max-w-[var(--chart-small-width)]')
    expect(CHART_LARGE_WIDTH).toContain('max-w-[var(--chart-large-width)]')
    expect(FIGURE_GAP).toBe('my-[var(--figure-gap)]')
    expect(LEGEND_HANG).toBe('-mt-[calc(var(--figure-gap)+var(--legend-overlap))]')
    expect(LEGEND_TUCK).toBe('pt-[calc(var(--legend-overlap)+1rem)]')
  })

  it('share their rows by subgrid: one count in all three classes, one fewer for the facts (#678)', () => {
    const rows = 4
    expect(SUBGRID_FOUR_ROWS).toContain(`row-span-${rows} `)
    expect(SUBGRID_FOUR_ROWS_EXPLICIT).toBe(`grid-rows-[repeat(${rows},auto)]`)
    // The foot is the last row, so the facts above it span one fewer
    expect(SUBGRID_THREE_ROWS).toContain(`row-span-${rows - 1} `)
    for (const classes of [SUBGRID_FOUR_ROWS, SUBGRID_THREE_ROWS]) {
      expect(classes).toContain('grid grid-rows-subgrid')
    }
  })

  it('keep the rows of cards that share them apart by a margin the list takes back', () => {
    // The margin equals the gap it replaces: gap-4 for a `CardGrid` gap="sm", gap-2 for tab buttons
    expect(SHARED_ROWS_SPACE_4).toEqual({ item: 'mb-4', list: '-mb-4 gap-y-0' })
    expect(SHARED_ROWS_SPACE_2).toEqual({ item: 'mb-2', list: '-mb-2 gap-y-0' })
  })

  it('are defined in globals.css, once each', () => {
    for (const name of [
      '--reading-width',
      '--page-min-height',
      '--hero-min-height',
      '--figure-gap',
      '--legend-overlap',
      '--chart-small-width',
      '--chart-large-width',
    ]) {
      const definitions = globalsCss.match(new RegExp(`^\\s*${name}:`, 'gm')) ?? []
      expect(definitions, name).toHaveLength(1)
    }
  })
})
