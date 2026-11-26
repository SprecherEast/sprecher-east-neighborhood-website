import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.join(__dirname, '..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

const siteFont = read('src/platform/theme/fonts.ts')
const showcaseFont = read('.storybook/fonts.css')
const siteFaces = [
  ...siteFont.matchAll(
    /path: '\.\/fonts\/([^']+)',\s*weight: '(\d+)',\s*style: '(normal|italic)'/g,
  ),
].map(([, file, weight, style]) => `${file} ${weight} ${style}`)
const showcaseFaces = [
  ...showcaseFont.matchAll(
    /@font-face\s*{\s*font-family: 'Poppins';\s*font-style: (normal|italic);\s*font-weight: (\d+);\s*font-display: swap;\s*src: url\('\.\.\/src\/platform\/theme\/fonts\/([^']+)'\) format\('woff2'\);\s*}/g,
  ),
].map(([, style, weight, file]) => `${file} ${weight} ${style}`)

// The showcase is built by Vite, not Next.js, so it cannot call fonts.ts (the Vite plugin that stands in for
// Next's font loader writes Google's font addresses into the built page). It declares the same faces over
// the same files, the site's own, and these tests keep the two lists equal and keep every font host and
// every second copy of the files out of the showcase.
describe('the showcase font', () => {
  it('declares every face the site font has, over the same files, and nothing else', () => {
    expect(siteFaces).toHaveLength(10)
    expect(showcaseFaces.sort()).toEqual([...siteFaces].sort())
  })

  it('names the family and the variable the theme reads', () => {
    expect(siteFont).toContain("variable: '--font-poppins'")
    expect(showcaseFont).toMatch(/:root\s*{\s*--font-poppins: 'Poppins';\s*}/)
  })

  it('is loaded by the showcase’s preview, which imports neither the site font nor next/font', () => {
    const preview = read('.storybook/preview.tsx')
    expect(preview).toMatch(/import '\.\/fonts\.css'/)
    expect(preview).not.toMatch(/theme\/fonts/)
    expect(preview).not.toMatch(/next\/font/)
    expect(preview).not.toMatch(/poppins/)
  })

  it('takes no font from a package or a third party', () => {
    for (const file of ['.storybook/fonts.css', '.storybook/preview.tsx', '.storybook/main.ts']) {
      const text = read(file)
      expect(text, file).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|next\/font/)
      expect(text, file).not.toMatch(/@fontsource/)
    }
    expect(read('package.json')).not.toMatch(/@fontsource/)
  })
})
