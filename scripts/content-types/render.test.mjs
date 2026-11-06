import { describe, expect, it } from 'vitest'

import {
  GENERATED_NOTICE,
  buildPages,
  renderAccess,
  renderFieldTable,
  renderHooks,
} from './render.mjs'

const row = (over) => ({
  path: 'title',
  type: 'text',
  required: 'yes',
  detail: '',
  notes: [],
  section: '',
  access: [],
  hooks: [],
  ...over,
})

describe('renderFieldTable', () => {
  it('writes one table row per field, with notes and field access joined', () => {
    const table = renderFieldTable([
      row({ notes: ['hidden', 'indexed'], access: ['read: admin'] }),
      row({ path: 'a|b', type: 'select', required: 'no', detail: 'x, y' }),
    ])
    expect(table.split('\n')).toEqual([
      '| Field | Type | Required | Target or options | Notes |',
      '| --- | --- | --- | --- | --- |',
      '| `title` | text | yes |  | hidden; indexed; access read: admin |',
      '| `a\\|b` | select | no | x, y |  |',
    ])
  })

  it('escapes a backslash before escaping a pipe, so a backslash can not cancel the escape', () => {
    const [, , body] = renderFieldTable([row({ detail: 'a\\|b', path: 'c\\|d' })]).split('\n')
    expect(body).toBe('| `c\\\\\\|d` | text | yes | a\\\\\\|b |  |')
  })
})

describe('renderAccess', () => {
  it('writes a table of operation, function and where it lives', () => {
    expect(
      renderAccess([{ operation: 'read', name: 'anyone', file: 'src/platform/payload/roles.ts' }]),
    ).toBe(
      [
        '| Operation | Function | Defined in |',
        '| --- | --- | --- |',
        '| read | `anyone` | `src/platform/payload/roles.ts` |',
      ].join('\n'),
    )
  })

  it('says the Payload default applies when nothing is set', () => {
    expect(renderAccess([])).toContain('default applies')
  })
})

describe('renderHooks', () => {
  it('writes nothing for a type with no hooks', () => {
    expect(renderHooks([])).toBe('None.')
  })

  it('writes phase, function and file', () => {
    expect(renderHooks([{ phase: 'beforeChange', name: 'hold', file: 'src/a.ts' }])).toContain(
      '| beforeChange | `hold` | `src/a.ts` |',
    )
  })
})

const model = (over) => ({
  slug: 'events',
  kind: 'collection',
  title: 'Events',
  purpose: 'Neighborhood events',
  versions: ['Drafts: no', 'Versions: none kept'],
  access: [],
  hooks: [],
  fields: [row()],
  auth: [],
  upload: [],
  ...over,
})

describe('buildPages', () => {
  it('starts every page with the generated notice, then the title', () => {
    const pages = buildPages([model()], { internal: [] })
    const events = pages.get('events.md')
    expect(events.split('\n')[0]).toBe(GENERATED_NOTICE)
    expect(events).toContain('# Events (`events`)')
  })

  it('lists every page in the README, one line each', () => {
    const pages = buildPages([model(), model({ slug: 'faq', title: 'FAQ' })], { internal: [] })
    const readme = pages.get('README.md')
    expect(readme).toContain('[`events`](events.md)')
    expect(readme).toContain('[`faq`](faq.md)')
  })

  it('puts the internal types on one shared page, each still listed in the README', () => {
    const pages = buildPages([model(), model({ slug: 'payload-kv', title: 'Payload kv' })], {
      internal: ['payload-kv'],
    })
    expect([...pages.keys()].sort()).toEqual(['README.md', 'events.md', 'payload-internal.md'])
    expect(pages.get('payload-internal.md')).toContain('## `payload-kv`')
    expect(pages.get('README.md')).toContain('[`payload-kv`](payload-internal.md#payload-kv)')
  })

  it('is the same on every run and sorts the pages by slug', () => {
    const models = [model({ slug: 'b' }), model({ slug: 'a' })]
    const first = buildPages(models, { internal: [] })
    const second = buildPages([...models].reverse(), { internal: [] })
    expect([...first]).toEqual([...second])
    expect(first.get('README.md').indexOf('(a.md)')).toBeLessThan(
      first.get('README.md').indexOf('(b.md)'),
    )
  })

  it('splits a page over the line limit into one page per section, linked from the main page', () => {
    const rows = [
      row({ path: 'title' }),
      ...Array.from({ length: 15 }, (_, i) => row({ path: `hero.f${i}`, section: 'Hero' })),
      ...Array.from({ length: 15 }, (_, i) => row({ path: `seo.f${i}`, section: 'SEO tab' })),
    ]
    const pages = buildPages([model({ fields: rows })], { internal: [], limit: 40 })
    expect([...pages.keys()].sort()).toEqual([
      'README.md',
      'events--hero.md',
      'events--seo-tab.md',
      'events.md',
    ])
    const main = pages.get('events.md')
    expect(main).toContain('[Hero](events--hero.md)')
    expect(main).toContain('`title`')
    expect(main).not.toContain('hero.f0')
    expect(pages.get('events--hero.md')).toContain('`hero.f0`')
    expect(pages.get('events--hero.md').split('\n')[0]).toBe(GENERATED_NOTICE)
  })

  it('keeps a page whole when it is within the limit', () => {
    const rows = [row(), row({ path: 'hero.type', section: 'Hero' })]
    const pages = buildPages([model({ fields: rows })], { internal: [] })
    expect([...pages.keys()].sort()).toEqual(['README.md', 'events.md'])
    expect(pages.get('events.md')).toContain('`hero.type`')
  })

  it('fails when a section is still over the limit, so the split is never silent', () => {
    const rows = Array.from({ length: 60 }, (_, i) => row({ path: `hero.f${i}`, section: 'Hero' }))
    expect(() => buildPages([model({ fields: rows })], { internal: [], limit: 40 })).toThrow(
      /events--hero\.md.*lines/,
    )
  })
})
