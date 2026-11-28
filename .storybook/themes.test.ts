import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ACTIVE_THEME } from '@/platform/theme/registry'
import { THEME_MODES, defaultTheme } from '@/platform/theme/theme'

import { THEME_NAMES, initialSiteGlobals, siteGlobalTypes } from './themes'

const THEMES_DIR = path.join(__dirname, '../src/themes')

describe('the showcase theme switch', () => {
  it('offers every theme the site defines, taken from the theme registry', () => {
    const folders = readdirSync(THEMES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    expect([...THEME_NAMES].sort()).toEqual(folders.sort())
    expect(siteGlobalTypes.siteTheme.toolbar.items).toEqual(THEME_NAMES)
  })

  it('offers every mode the site defines, in its order', () => {
    expect(siteGlobalTypes.mode.toolbar.items.map((item) => item.value)).toEqual([...THEME_MODES])
  })

  it('gives every mode its own label, made from the mode', () => {
    const titles = siteGlobalTypes.mode.toolbar.items.map((item) => item.title)

    expect(new Set(titles).size).toBe(THEME_MODES.length)
    expect(titles).toEqual(THEME_MODES.map((mode) => mode[0].toUpperCase() + mode.slice(1)))
  })

  it("starts on the site's own defaults: its default mode and its active theme", () => {
    expect(initialSiteGlobals).toEqual({ siteTheme: ACTIVE_THEME, mode: defaultTheme })
  })
})
