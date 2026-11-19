import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The demo seed reads its local photos from public/images/ (#753). If a name drifts or a file is
// removed, the seed silently falls back to remote images, so keep the two in step.
const seedSource = readFileSync(path.resolve(__dirname, 'index.ts'), 'utf8')
const imageNames = [...seedSource.matchAll(/loadLocalImage\('([^']+)'/g)].map((m) => m[1])

describe('demo seed local images', () => {
  it('loads from public/images only', () => {
    expect(seedSource).toContain("'public/images'")
    expect(seedSource).not.toContain('assets/images')
  })

  it.each(imageNames)('finds %s in public/images', (name) => {
    expect(existsSync(path.resolve(process.cwd(), 'public/images', name))).toBe(true)
  })

  it('names at least one image', () => {
    expect(imageNames.length).toBeGreaterThan(0)
  })
})
