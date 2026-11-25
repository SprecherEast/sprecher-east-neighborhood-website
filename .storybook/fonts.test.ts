import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.join(__dirname, '..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

const siteFont = read('src/platform/theme/fonts.ts')
const showcaseFont = read('.storybook/fonts.css')
const list = (key: string) =>
  [
    ...(siteFont.match(new RegExp(`${key}: \\[([^\\]]*)\\]`))?.[1].matchAll(/'([^']+)'/g) ?? []),
  ].map((match) => match[1])
const imported = [
  ...showcaseFont.matchAll(/^@import '@fontsource\/poppins\/([^']+)\.css';$/gm),
].map((match) => match[1])

// The showcase is built by Vite, not Next.js, so it cannot use fonts.ts (its plugin points each viewer's
// browser at Google). It serves the same family from the fontsource package, and these tests keep the two
// descriptions of the font equal and keep Google's font hosts out of the showcase's own files.
describe('the showcase font', () => {
  it('has every weight and style the site font has, and nothing else', () => {
    const subsets = list('subsets')
    expect(subsets).toEqual(['latin'])
    const expected = list('weight').flatMap((weight) =>
      list('style').map((style) => `${subsets[0]}-${weight}${style === 'italic' ? '-italic' : ''}`),
    )
    expect(expected.length).toBeGreaterThan(0)
    expect([...imported].sort()).toEqual([...expected].sort())
  })

  it('reads those weights from the site font file, so a change there fails here', () => {
    expect(list('weight')).toEqual(['300', '400', '500', '600', '700'])
    expect(list('style')).toEqual(['normal', 'italic'])
  })

  it('names the family and the variable the theme reads', () => {
    expect(siteFont).toContain("variable: '--font-poppins'")
    expect(showcaseFont).toMatch(/:root\s*{\s*--font-poppins: 'Poppins';\s*}/)
  })

  it('is loaded by the showcase’s preview, which no longer imports the site font or next/font', () => {
    const preview = read('.storybook/preview.tsx')
    expect(preview).toMatch(/import '\.\/fonts\.css'/)
    expect(preview).not.toMatch(/theme\/fonts/)
    expect(preview).not.toMatch(/next\/font/)
    expect(preview).not.toMatch(/poppins/)
  })

  it('asks no third party for a font anywhere in the showcase’s settings', () => {
    for (const file of ['.storybook/fonts.css', '.storybook/preview.tsx', '.storybook/main.ts'])
      expect(read(file), file).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|next\/font/)
  })
})
