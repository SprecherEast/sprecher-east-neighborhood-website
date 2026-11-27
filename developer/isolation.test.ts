// The developer pages are never part of the site (#1530): the site's own app holds no route for
// them, so there is nothing on sprechereast.com or a pull request preview to answer or to forget to
// hide. They exist only as the plain files ops/developer-site.sh publishes at dev.sprechereast.com.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const SITE_APP = path.join(ROOT, 'src/app')

/** Every folder under `dir` (route segments, route groups included), as paths below it. */
function folders(dir: string, base = ''): string[] {
  return fs.readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(base, entry.name)
    return entry.isDirectory() ? [relative, ...folders(dir, relative)] : []
  })
}

describe('the site does not hold the developer pages', () => {
  const pageFolders = ['showcase', 'developer'] // the developer pages' routes, and the old name of a group
  it.each(pageFolders)('has no `%s` route in src/app', (name) => {
    const found = folders(SITE_APP).filter((folder) =>
      folder.split(path.sep).some((part) => part === name || part === `(${name})`),
    )
    expect(found).toEqual([])
  })

  it('does not export the site as static files, which would drop the app', () => {
    const config = fs.readFileSync(path.join(ROOT, 'next.config.js'), 'utf8')
    expect(config).not.toMatch(/output:\s*['"]export['"]/)
  })

  it('lists no developer page in the sitemap', () => {
    const sitemap = fs.readFileSync(path.join(SITE_APP, 'sitemap.ts'), 'utf8')
    expect(sitemap).not.toMatch(/showcase|developer/i)
  })

  it('keeps the developer pages outside src/, so the site build never compiles them', () => {
    expect(fs.existsSync(path.join(ROOT, 'developer/app/layout.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(ROOT, 'src/developer'))).toBe(false)
  })
})
