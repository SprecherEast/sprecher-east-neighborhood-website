import { describe, expect, it } from 'vitest'

import { neverInlineFonts } from './inlineLimit'

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
  })

  it('is what the showcase’s settings give Vite', async () => {
    const { readFileSync } = await import('node:fs')
    const main = readFileSync(`${__dirname}/main.ts`, 'utf8')
    expect(main).toMatch(/from '\.\/inlineLimit'/)
    expect(main).toMatch(/assetsInlineLimit: neverInlineFonts/)
  })
})
