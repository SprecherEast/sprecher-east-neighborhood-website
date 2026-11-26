import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.join(__dirname, '../../..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const fontsDir = path.join(__dirname, 'fonts')

const source = read('src/platform/theme/fonts.ts')
// Each `{ path, weight, style }` entry of the font's `src` list, read from the source because next/font only
// runs inside Next's build
const faces = [
  ...source.matchAll(/path: '(\.\/fonts\/[^']+)',\s*weight: '(\d+)',\s*style: '(normal|italic)'/g),
].map(([, file, weight, style]) => ({ file, weight, style }))

// The site's body font is defined once (fonts.ts), from the font files kept in the repository next to it, and
// every surface reads it from there: the root layout imports that one object, and the component showcase
// serves the same files (.storybook/fonts.test.ts keeps its list equal to this one).
describe('the site font', () => {
  it('is defined in fonts.ts alone, from local files (no request to a font host)', () => {
    expect(source).toMatch(/from 'next\/font\/local'/)
    expect(source).not.toMatch(/next\/font\/google|fonts\.googleapis|fonts\.gstatic/)
    const layout = read('src/app/(frontend)/layout.tsx')
    expect(layout).toMatch(/from '@\/platform\/theme\/fonts'/)
    expect(layout).not.toMatch(/next\/font/)
  })

  it('keeps the CSS variable the theme reads', () => {
    expect(source).toContain("variable: '--font-poppins'")
    expect(read('src/app/(frontend)/globals.css')).toContain('var(--font-poppins)')
  })

  it('lists every weight, upright and italic, from 300 to 700', () => {
    const wanted = ['300', '400', '500', '600', '700'].flatMap((weight) =>
      ['normal', 'italic'].map((style) => `${weight} ${style}`),
    )
    expect(faces.map((face) => `${face.weight} ${face.style}`).sort()).toEqual(wanted.sort())
  })

  it('has each listed file in the folder, a real woff2, and no file that nothing lists', () => {
    for (const { file, weight, style } of faces) {
      const name = file.replace('./fonts/', '')
      expect(name).toBe(`poppins-latin-${weight}-${style}.woff2`)
      expect(existsSync(path.join(__dirname, file)), name).toBe(true)
      expect(readFileSync(path.join(__dirname, file)).subarray(0, 4).toString('latin1')).toBe(
        'wOF2',
      )
    }
    const listed = faces.map((face) => face.file.replace('./fonts/', ''))
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
