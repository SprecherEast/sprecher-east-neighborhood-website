import { describe, expect, it } from 'vitest'

import { THEME_MODES, themeIsValid } from './theme'

describe('the light and dark modes', () => {
  it('are listed once, and themeIsValid accepts exactly those', () => {
    expect([...THEME_MODES].sort()).toEqual(['dark', 'light'])
    for (const mode of THEME_MODES) expect(themeIsValid(mode)).toBe(true)
    for (const other of ['auto', 'Light', '', null]) expect(themeIsValid(other)).toBe(false)
  })
})
