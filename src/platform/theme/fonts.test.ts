import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.join(__dirname, '../../..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

// next/font only runs inside Next's build, so this checks the source: the site's body font is defined
// once (fonts.ts) and the root layout imports that one object. The showcase is built by Vite and serves the
// same font from its own files (.storybook/fonts.test.ts keeps the two equal)
describe('the site font', () => {
  it('is defined in fonts.ts alone', () => {
    expect(read('src/platform/theme/fonts.ts')).toMatch(/Poppins\(\{/)
    const layout = read('src/app/(frontend)/layout.tsx')
    expect(layout).toMatch(/from '@\/platform\/theme\/fonts'/)
    expect(layout).not.toMatch(/next\/font/)
  })

  it('keeps the CSS variable the theme reads', () => {
    expect(read('src/platform/theme/fonts.ts')).toContain("variable: '--font-poppins'")
    expect(read('src/app/(frontend)/globals.css')).toContain('var(--font-poppins)')
  })
})
