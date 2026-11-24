import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { pluginDefining } from './pluginSlugs.mjs'

describe('pluginDefining', () => {
  it('finds the plugin package whose code sets the slug, by default or plainly', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-plugin-slugs-'))
    const write = (file, text) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), text)
    }
    write(
      'node_modules/@payloadcms/plugin-a/dist/c/forms.js',
      "const x = { slug: o?.slug || 'forms', y: 1 }\n",
    )
    write('node_modules/@payloadcms/plugin-b/dist/index.js', "const x = { slug: 'search' }\n")
    write('node_modules/@payloadcms/plugin-c/dist/index.js', "const slugs = ['forms']\n")
    // a test file inside a package and a file that is not JavaScript set no slug
    write('node_modules/@payloadcms/plugin-t/dist/a.test.js', "const x = { slug: 'tested' }\n")
    write('node_modules/@payloadcms/plugin-t/dist/a.d.ts', "const x = { slug: 'typed' }\n")
    // a slug with a dot is read as that text, not as a pattern: `a.b` is not `axb`
    write('node_modules/@payloadcms/plugin-d/dist/index.js', "const x = { slug: 'axb' }\n")
    write('node_modules/@payloadcms/plugin-e/dist/index.js', "const x = { slug: 'a.b' }\n")
    const plugins = [
      '@payloadcms/plugin-d',
      '@payloadcms/plugin-e',
      '@payloadcms/plugin-c',
      '@payloadcms/plugin-a',
      '@payloadcms/plugin-b',
      '@payloadcms/plugin-gone',
    ]
    const found = [
      pluginDefining(root, 'forms', plugins),
      pluginDefining(root, 'search', plugins),
      pluginDefining(root, 'none', plugins),
      pluginDefining(root, 'a.b', plugins),
      pluginDefining(root, 'tested', [...plugins, '@payloadcms/plugin-t']),
      pluginDefining(root, 'typed', [...plugins, '@payloadcms/plugin-t']),
    ]
    fs.rmSync(root, { recursive: true, force: true })
    expect(found).toEqual([
      '@payloadcms/plugin-a',
      '@payloadcms/plugin-b',
      '',
      '@payloadcms/plugin-e',
      '',
      '',
    ])
  })
})
