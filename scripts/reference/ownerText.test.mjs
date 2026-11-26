import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ownerText } from './loadFacts.mjs'

const model = (slug, files = []) => ({
  slug,
  access: [],
  hooks: [],
  fields: [],
  allEndpoints: files.map((file) => ({ file })),
})

describe('ownerText', () => {
  it('names the plugin that sets the slug, with the modules that configure it (#1461)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reference-owner-'))
    const dist = path.join(root, 'node_modules/@payloadcms/plugin-x/dist')
    fs.mkdirSync(dist, { recursive: true })
    fs.writeFileSync(path.join(dist, 'index.js'), "const c = { slug: o?.slug || 'forms' }\n")
    const configurers = new Map([['@payloadcms/plugin-x', ['contact', 'verification']]])
    const found = [
      ownerText(model('forms'), new Map(), configurers, root),
      ownerText(model('events', ['@payloadcms/plugin-x']), new Map(), configurers, root),
      ownerText(model('unknown'), new Map(), configurers, root),
    ]
    fs.rmSync(root, { recursive: true, force: true })
    const plugin =
      'the plugin `@payloadcms/plugin-x`, configured with code from module `contact` and module `verification`'
    const data = { plugin: '@payloadcms/plugin-x', modules: ['contact', 'verification'] }
    expect(found[0]).toEqual({ owner: plugin, file: '', ...data })
    expect(found[1]).toEqual({ owner: plugin, file: '', ...data })
    expect(found[2].owner).toMatch(/^a plugin or Payload/)
  })

  it('names only the plugin when no module of ours configures it', () => {
    const configurers = new Map([['@payloadcms/plugin-x', []]])
    const found = ownerText(model('events', ['@payloadcms/plugin-x']), new Map(), configurers, '/x')
    expect(found).toEqual({
      owner: 'the plugin `@payloadcms/plugin-x`',
      file: '',
      plugin: '@payloadcms/plugin-x',
      modules: [],
    })
  })
})
