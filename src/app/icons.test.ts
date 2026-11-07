import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/** `--primary` in theme.css: the light value first, then the dark one. */
const [light, dark] = [
  ...read('src/themes/default/theme.css').matchAll(/^\s*--primary:\s*(#[0-9a-f]{6});/gim),
].map((m) => m[1])

describe('site icons (#749)', () => {
  it.each(['favicon.ico', 'icon.svg', 'apple-icon.png'])(
    'src/app/%s exists for the native file convention',
    (file) => {
      expect(existsSync(join(process.cwd(), 'src/app', file))).toBe(true)
    },
  )

  it('the layout no longer links icon files by hand', () => {
    expect(read('src/app/(frontend)/layout.tsx')).not.toMatch(/favicon|rel="icon"/)
  })

  it('the SVG uses the theme primary colour in light and dark', () => {
    const svg = read('src/app/icon.svg')
    expect(svg).toContain(light)
    expect(svg).toContain(dark)
    expect(svg).toContain('prefers-color-scheme: dark')
  })
})
