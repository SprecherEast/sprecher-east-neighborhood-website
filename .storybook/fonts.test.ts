import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { siteFontCalls } from '../src/platform/theme/testing/fontFaces'

const root = path.join(__dirname, '..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

const showcaseFont = read('.storybook/fonts.css')
const calls = siteFontCalls()

// The family name each CSS variable is given in `.storybook/fonts.css`
const family = (variable: string) =>
  showcaseFont.match(new RegExp(`${variable}: '([^']+)';`))?.[1] ?? `(no ${variable})`

const descriptor = (block: string, name: string) =>
  block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim() ?? ''

// What the showcase declares, each @font-face read by its descriptors in any order. One that lacks a
// descriptor reads as an empty value and so matches nothing in the site's list.
const facesOf = (css: string) =>
  css
    .split('@font-face')
    .slice(1)
    .map((block) => {
      const url = descriptor(block, 'src').match(
        /^url\('\.\.\/src\/platform\/theme\/fonts\/([^']+)'\) format\('woff2'\)$/,
      )?.[1]
      return [
        descriptor(block, 'font-family').replace(/'/g, ''),
        url ?? '',
        descriptor(block, 'font-weight'),
        descriptor(block, 'font-style'),
        descriptor(block, 'unicode-range').replace(/\s+/g, ''),
        descriptor(block, 'font-display'),
      ].join(' | ')
    })
const showcaseFaces = facesOf(showcaseFont)

const siteFaces = calls.flatMap((call) =>
  call.faces.map((face) =>
    [family(call.variable), face.file, face.weight, face.style, call.range, 'swap'].join(' | '),
  ),
)

// The showcase is built by Vite, not Next.js, so it cannot call fonts.ts (the Vite plugin that stands in for
// Next's font loader writes Google's font addresses into the built page). It declares the same faces over
// the same files, the site's own, and these tests keep the two lists equal and keep every font host and
// every second copy of the files out of the showcase.
describe('the showcase font', () => {
  it('declares every face the site font has, over the same files, and no other', () => {
    expect(siteFaces).toHaveLength(20)
    expect(showcaseFaces.sort()).toEqual([...siteFaces].sort())
  })

  it('rejects an extra face however its lines are ordered, and one with a line missing', () => {
    const face = (lines: string) => `${showcaseFont}\n@font-face {\n${lines}}\n`
    const lines = [
      "  src: url('../src/platform/theme/fonts/poppins-latin-400-normal.woff2') format('woff2');\n",
      '  font-weight: 800;\n',
      "  font-family: 'Poppins';\n",
      '  font-style: normal;\n',
      '  font-display: swap;\n',
    ]
    // Whole, in an order the site's own list never uses
    expect(facesOf(face(lines.join(''))).sort()).not.toEqual([...siteFaces].sort())
    expect(facesOf(face(lines.join(''))).length).toBe(siteFaces.length + 1)
    // With each line left out in turn
    for (const [index] of lines.entries()) {
      const css = face(lines.filter((_, i) => i !== index).join(''))
      expect(facesOf(css).sort(), `without line ${index}`).not.toEqual([...siteFaces].sort())
    }
    // The real file is equal, so none of the above is a false alarm
    expect(showcaseFaces.sort()).toEqual([...siteFaces].sort())
  })

  it('names the families and the variables the theme reads', () => {
    expect(family('--font-poppins')).toBe('Poppins')
    expect(family('--font-poppins-ext')).toBe('Poppins Latin Ext')
    expect(showcaseFont).toMatch(/:root\s*{[^}]*--font-poppins: 'Poppins';/)
  })

  it('declares the latin-ext variable before the latin one, as font-sans reads them', () => {
    // The theme's font-sans lists latin-ext first (src/platform/theme/fonts.test.ts says why); the showcase
    // reads that same font-sans, and its variables are declared in the same order so the two stay equal.
    expect(showcaseFont.indexOf('--font-poppins-ext:')).toBeGreaterThan(-1)
    expect(showcaseFont.indexOf('--font-poppins-ext:')).toBeLessThan(
      showcaseFont.indexOf('--font-poppins:'),
    )
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
