import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { THEME_MODES } from '@/platform/theme/theme'

import { THEME_NAMES, siteGlobalTypes } from './themes'

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
})
