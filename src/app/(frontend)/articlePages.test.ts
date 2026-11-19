import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))

// No card preview goes inside a post or event page's layout, in any mode (owner's rule, #532).
// The live-refresh listener is the page's only "preview" in the code, and it draws nothing.
describe.each(['posts/[slug]/page.tsx', 'events/[slug]/page.tsx'])('%s', (file) => {
  it('renders no card preview', () => {
    const source = readFileSync(path.join(here, file), 'utf8')
    expect(source.replace(/LivePreviewListener/g, '')).not.toMatch(/preview/i)
  })
})
