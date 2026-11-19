import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DECORATIONS } from './options'
import { ACTIVE_THEME, THEMES, getThemeOptions } from './registry'

const THEMES_DIR = join(process.cwd(), 'src/themes')
const folders = readdirSync(THEMES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

describe('the theme registry (#409)', () => {
  it('lists exactly the theme folders', () => {
    expect(Object.keys(THEMES).sort()).toEqual(folders)
  })

  it('is what the frontend stylesheet imports for the active theme', () => {
    const globals = readFileSync(join(process.cwd(), 'src/app/(frontend)/globals.css'), 'utf8')
    expect(globals).toContain(`@import '../../themes/${ACTIVE_THEME}/theme.css';`)
  })

  it('gives every theme a known decoration or none', () => {
    for (const name of Object.keys(THEMES) as Array<keyof typeof THEMES>) {
      const { decoration } = getThemeOptions(name)
      expect(decoration === null || DECORATIONS.includes(decoration)).toBe(true)
    }
  })

  it('keeps the default theme undecorated', () => {
    expect(getThemeOptions('default')).toEqual({ decoration: null })
  })
})
