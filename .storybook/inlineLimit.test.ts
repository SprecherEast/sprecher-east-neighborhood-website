import { describe, expect, it } from 'vitest'

import { neverInlineFonts } from './inlineLimit'
import config from './main'

// Vite inlines an asset under 4 KiB as a data URL. A small font face inlined that way would leave the
// showcase without its `<face>-<hash>.woff2` file, and ops/developer-site-check.sh would refuse the whole
// showcase. Fonts are never inlined; other assets keep Vite's own limit.
describe('the showcase’s inline limit', () => {
  it('never inlines a font file, however small', () => {
    expect(neverInlineFonts('/x/poppins-latin-400-normal.woff2')).toBe(false)
    expect(neverInlineFonts('/x/A.WOFF2')).toBe(false)
  })

  it('leaves every other asset to Vite’s own limit', () => {
    expect(neverInlineFonts('/x/logo.svg')).toBeUndefined()
    expect(neverInlineFonts('/x/woff2.png')).toBeUndefined()
    // Only a name that ENDS in .woff2 is a font file: not one that continues, nor one with no dot
    expect(neverInlineFonts('/x/a.woff2.png')).toBeUndefined()
    expect(neverInlineFonts('/x/fakewoff2')).toBeUndefined()
  })

  it('is what the showcase’s settings give Vite, in `build.assetsInlineLimit`', async () => {
    // Runs the Storybook config's own `viteFinal` on a Vite config, so a moved or removed option fails
    const result = await config.viteFinal?.({ build: { minify: false } }, {} as never)
    expect(result?.build?.assetsInlineLimit).toBe(neverInlineFonts)
    expect(result?.build?.minify).toBe(false) // the config it was given is kept
    expect(result).not.toHaveProperty('assetsInlineLimit')
  })
})
