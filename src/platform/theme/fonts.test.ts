import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.join(__dirname, '../../..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

// next/font only runs inside Next's or Storybook's build, so this checks the source: the site's
// body font is defined once (fonts.ts) and every place that needs it imports that one object
describe('the site font', () => {
  it('is defined in fonts.ts alone', () => {
    expect(read('src/platform/theme/fonts.ts')).toMatch(/Poppins\(\{/)
    for (const user of ['src/app/(frontend)/layout.tsx', '.storybook/preview.tsx']) {
      const source = read(user)
      expect(source, user).toMatch(/from '@\/platform\/theme\/fonts'/)
      expect(source, user).not.toMatch(/next\/font/)
    }
  })

  it('keeps the CSS variable the theme reads', () => {
    expect(read('src/platform/theme/fonts.ts')).toContain("variable: '--font-poppins'")
    expect(read('src/app/(frontend)/globals.css')).toContain('var(--font-poppins)')
  })
})
