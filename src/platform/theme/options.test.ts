import { describe, expect, it } from 'vitest'

import { DEFAULT_THEME_OPTIONS, resolveThemeOptions } from './options'

describe('resolveThemeOptions (#409)', () => {
  it('gives a theme that sets nothing every default', () => {
    expect(resolveThemeOptions()).toEqual(DEFAULT_THEME_OPTIONS)
    expect(resolveThemeOptions({})).toEqual({ decoration: null })
  })

  it('keeps what a theme sets', () => {
    expect(resolveThemeOptions({ decoration: 'snowfall' })).toEqual({ decoration: 'snowfall' })
  })

  it('never changes the defaults', () => {
    resolveThemeOptions({ decoration: 'snowfall' })
    expect(DEFAULT_THEME_OPTIONS.decoration).toBeNull()
  })
})
