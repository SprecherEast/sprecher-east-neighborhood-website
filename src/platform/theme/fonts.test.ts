import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { siteFontCalls } from './testing/fontFaces'

const root = path.join(__dirname, '../../..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const fontsDir = path.join(__dirname, 'fonts')

const source = read('src/platform/theme/fonts.ts')
const [latin, ext] = siteFontCalls()
const listed = [...latin.faces, ...ext.faces].map((face) => face.file)

// The site's body font is defined once (fonts.ts), from the font files kept in the repository next to it, and
// every surface reads it from there: the root layout imports those objects, and the component showcase
// serves the same files (.storybook/fonts.test.ts keeps its list equal to this one).
describe('the site font', () => {
  it('is defined in fonts.ts alone, from local files (no request to a font host)', () => {
    expect(source).toMatch(/from 'next\/font\/local'/)
    expect(source).not.toMatch(/next\/font\/google|fonts\.googleapis|fonts\.gstatic/)
    const layout = read('src/app/(frontend)/layout.tsx')
    expect(layout).toMatch(/from '@\/platform\/theme\/fonts'/)
    expect(layout).not.toMatch(/next\/font/)
  })

  it('has two definitions: latin, preloaded, and latin-ext, fetched only for a page that needs it', () => {
    expect(siteFontCalls()).toHaveLength(2)
    expect(latin).toMatchObject({ variable: '--font-poppins', preload: true, range: '' })
    expect(ext).toMatchObject({ variable: '--font-poppins-ext', preload: false })
    // Fontsource's own range for the latin-ext subset: a page without those letters never fetches it
    expect(ext.range).toMatch(/^U\+0100-02BA,/)
    expect(ext.range).toContain('U+A720-A7FF')
  })

  it('keeps the CSS variables the theme reads, latin first, latin-ext after it', () => {
    const css = read('src/app/(frontend)/globals.css')
    expect(css).toContain('var(--font-poppins), var(--font-poppins-ext),')
    const layout = read('src/app/(frontend)/layout.tsx')
    expect(layout).toMatch(/poppins\.variable/)
    expect(layout).toMatch(/poppinsLatinExt\.variable/)
  })

  it('lists every weight, upright and italic, from 300 to 700, in each subset', () => {
    const wanted = ['300', '400', '500', '600', '700'].flatMap((weight) =>
      ['normal', 'italic'].map((style) => `${weight} ${style}`),
    )
    for (const call of [latin, ext])
      expect(call.faces.map((face) => `${face.weight} ${face.style}`).sort()).toEqual(wanted.sort())
  })

  it('reads a face by its keys in any order, and refuses one it cannot read', () => {
    const shuffled = `localFont({
  src: [
    { style: 'normal', path: './fonts/a.woff2', weight: '800' },
  ],
  variable: '--x',
})`
    expect(siteFontCalls(shuffled)[0].faces).toEqual([
      { file: 'a.woff2', weight: '800', style: 'normal' },
    ])
    expect(() => siteFontCalls(shuffled.replace("style: 'normal', ", ''))).toThrow(/missing a key/)
    expect(() => siteFontCalls(shuffled.replace("'./fonts/a.woff2'", '"./fonts/a.woff2"'))).toThrow(
      /missing a key/,
    )
  })

  it('has each listed file in the folder, named for its face, a real woff2, and no file nothing lists', () => {
    for (const call of [latin, ext])
      for (const { file, weight, style } of call.faces) {
        const subset = call === ext ? 'latin-ext' : 'latin'
        expect(file).toBe(`poppins-${subset}-${weight}-${style}.woff2`)
        expect(existsSync(path.join(fontsDir, file)), file).toBe(true)
        expect(readFileSync(path.join(fontsDir, file)).subarray(0, 4).toString('latin1')).toBe(
          'wOF2',
        )
      }
    expect(new Set(listed).size).toBe(20)
    expect(readdirSync(fontsDir).sort()).toEqual([...listed, 'OFL.txt'].sort())
  })

  it('keeps the font’s own licence (SIL OFL 1.1) next to the files', () => {
    const licence = read('src/platform/theme/fonts/OFL.txt')
    expect(licence).toContain('Poppins Project Authors')
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1')
  })

  it('is not served from an npm package any more', () => {
    expect(read('package.json')).not.toMatch(/@fontsource/)
    expect(read('package-lock.json')).not.toMatch(/@fontsource/)
  })
})
