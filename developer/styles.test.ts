import fs from 'node:fs'
import path from 'node:path'

import tailwindcss from '@tailwindcss/postcss'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

const DEVELOPER = __dirname

describe('the developer pages’ stylesheet', () => {
  // Next.js builds this project from its own folder, and Tailwind reads class names from where it is built
  // (its `base`). A page built that way must still get the kit's classes, which live in src/.
  it('holds the classes of the kit’s components, not only the theme’s colours', async () => {
    const file = path.join(DEVELOPER, 'app/globals.css')
    const { css } = await postcss([tailwindcss({ base: DEVELOPER })]).process(
      fs.readFileSync(file, 'utf8'),
      { from: file },
    )
    // PageHeader and Card, which the home page uses, write these
    expect(css).toContain('.text-4xl')
    expect(css).toContain('.rounded-2xl')
    // and the theme the site's pages use, in both modes
    expect(css).toContain("[data-theme='dark']")
  })

  it('names the kit’s folder and its own as places to read classes from, and imports the site’s stylesheet', () => {
    const css = fs.readFileSync(path.join(DEVELOPER, 'app/globals.css'), 'utf8')
    expect(css).toContain("@import '../../src/app/(frontend)/globals.css';")
    expect(css).toContain("@source '../../src';")
    expect(css).toContain("@source './';")
  })
})
