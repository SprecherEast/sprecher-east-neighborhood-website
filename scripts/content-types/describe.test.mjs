import { describe, expect, it } from 'vitest'

import {
  describeAccess,
  describeFields,
  describeHooks,
  describeVersions,
  fileFromUrl,
} from './describe.mjs'

function isAdmin() {}
function anyone() {}
const locate = (fn) => (fn === isAdmin ? 'src/platform/payload/roles.ts' : 'payload')

describe('fileFromUrl', () => {
  const root = '/work/repo'

  it('gives a path under the repo root relative to it, without a loader query', () => {
    expect(fileFromUrl('file:///work/repo/src/a/b.ts?tsx-namespace=1', root)).toBe('src/a/b.ts')
  })

  it('names the package for a file in node_modules, scoped or not', () => {
    expect(fileFromUrl('file:///work/repo/node_modules/payload/dist/x.js', root)).toBe('payload')
    expect(
      fileFromUrl('file:///work/repo/node_modules/@payloadcms/plugin-search/dist/y.js', root),
    ).toBe('@payloadcms/plugin-search')
  })

  it('names the package when node_modules is a link into another checkout', () => {
    expect(fileFromUrl('file:///other/node_modules/payload/dist/x.js', root)).toBe('payload')
  })

  it('never leaks an absolute path or a missing script', () => {
    expect(fileFromUrl('file:///elsewhere/z.js', root)).toBe('unknown')
    expect(fileFromUrl(undefined, root)).toBe('unknown')
    expect(fileFromUrl('node:internal/x', root)).toBe('Node.js')
  })
})

describe('describeAccess', () => {
  it('lists the operations in a fixed order with the function behind each', () => {
    const access = { delete: isAdmin, read: anyone, create: isAdmin, admin: isAdmin }
    expect(describeAccess(access, locate)).toEqual([
      { operation: 'create', name: 'isAdmin', file: 'src/platform/payload/roles.ts' },
      { operation: 'read', name: 'anyone', file: 'payload' },
      { operation: 'delete', name: 'isAdmin', file: 'src/platform/payload/roles.ts' },
      { operation: 'admin', name: 'isAdmin', file: 'src/platform/payload/roles.ts' },
    ])
  })

  it('shows an anonymous function as inline', () => {
    const anonymous = (
      () => () =>
        true
    )()
    expect(describeAccess({ read: anonymous }, locate)).toEqual([
      { operation: 'read', name: 'inline', file: 'payload' },
    ])
  })
})

describe('describeHooks', () => {
  it('lists hooks by phase in the order Payload runs the phases, each in its own order', () => {
    const hooks = {
      afterChange: [function revalidate() {}],
      beforeChange: [isAdmin, function second() {}],
      beforeValidate: [],
    }
    expect(describeHooks(hooks, locate).map((h) => [h.phase, h.name])).toEqual([
      ['beforeChange', 'isAdmin'],
      ['beforeChange', 'second'],
      ['afterChange', 'revalidate'],
    ])
  })
})

describe('describeVersions', () => {
  it('says there are no drafts when versions are off', () => {
    expect(describeVersions(undefined)).toEqual(['Drafts: no', 'Versions: none kept'])
  })

  it('describes drafts, autosave, scheduled publishing and the version limit', () => {
    expect(
      describeVersions({
        drafts: { autosave: { interval: 100 }, schedulePublish: true, validate: false },
        maxPerDoc: 25,
      }),
    ).toEqual([
      'Drafts: yes (autosave every 100 ms, scheduled publishing)',
      'Versions: the last 25 of each document',
    ])
  })

  it('says plain drafts when autosave is off', () => {
    expect(describeVersions({ drafts: { autosave: false }, maxPerDoc: 100 })[0]).toBe(
      'Drafts: yes (no autosave)',
    )
  })
})

describe('describeFields', () => {
  it('describes type, required, relation, options and notes', () => {
    const rows = describeFields([
      { name: 'title', type: 'text', required: true, maxLength: 80 },
      { name: 'category', type: 'relationship', relationTo: ['posts', 'pages'], hasMany: true },
      { name: 'hero', type: 'upload', relationTo: 'media' },
      {
        name: 'kind',
        type: 'select',
        options: ['a', { label: 'B', value: 'b' }],
        defaultValue: 'a',
      },
      { name: 'secret', type: 'text', admin: { hidden: true, readOnly: true }, index: true },
    ])
    expect(rows.map((r) => [r.path, r.type, r.required, r.detail, r.notes])).toEqual([
      ['title', 'text', 'yes', '', ['max length 80']],
      ['category', 'relationship', 'no', '→ posts, pages (many)', []],
      ['hero', 'upload', 'no', '→ media', []],
      ['kind', 'select', 'no', 'a, b', ['default a']],
      ['secret', 'text', 'no', '', ['hidden', 'read only', 'indexed']],
    ])
  })

  it('walks rows, collapsibles, groups, arrays and blocks, with a path for each field', () => {
    const rows = describeFields([
      { type: 'row', fields: [{ name: 'a', type: 'text' }] },
      { type: 'collapsible', fields: [{ name: 'b', type: 'text' }] },
      {
        name: 'meta',
        type: 'group',
        fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
      },
      { name: 'links', type: 'array', fields: [{ name: 'url', type: 'text' }] },
      {
        name: 'layout',
        type: 'blocks',
        blocks: [{ slug: 'cta', fields: [{ name: 'heading', type: 'text' }] }],
      },
    ])
    expect(rows.map((r) => r.path)).toEqual([
      'a',
      'b',
      'meta',
      'meta.image',
      'links',
      'links[].url',
      'layout',
      'layout{cta}',
      'layout{cta}.heading',
    ])
    expect(rows.find((r) => r.path === 'layout').detail).toBe('blocks: cta')
  })

  it('puts the fields of a tab in a section named after the tab, and a named tab in the path', () => {
    const rows = describeFields([
      { name: 'title', type: 'text' },
      {
        type: 'tabs',
        tabs: [
          {
            label: 'Hero',
            name: 'hero',
            fields: [{ name: 'type', type: 'select', options: ['x'] }],
          },
          { label: 'SEO', fields: [{ name: 'description', type: 'text' }] },
        ],
      },
    ])
    expect(rows.map((r) => [r.path, r.section])).toEqual([
      ['title', ''],
      ['hero.type', 'Hero'],
      ['description', 'SEO'],
    ])
  })

  it('sections a top-level group, array or blocks field by its own name', () => {
    const rows = describeFields([
      { name: 'cost', type: 'group', fields: [{ name: 'usd', type: 'number' }] },
    ])
    expect(rows.map((r) => r.section)).toEqual(['cost', 'cost'])
  })

  it('skips ui fields, which hold no data', () => {
    expect(describeFields([{ name: 'docUrl', type: 'ui' }])).toEqual([])
  })

  it('records field access and hooks by function name, grouping operations that share one', () => {
    function nobody() {}
    function staff() {}
    const [row] = describeFields(
      [
        {
          name: 'email',
          type: 'text',
          access: { create: nobody, read: nobody, update: nobody, delete: staff },
          hooks: { beforeChange: [function clean() {}], afterRead: [] },
        },
      ],
      { locate },
    )
    expect(row.access).toEqual(['create, read, update: nobody', 'delete: staff'])
    expect(row.hooks).toEqual([{ phase: 'beforeChange', name: 'clean', file: 'payload' }])
  })

  it('describes a join field by the collection and field it reads from', () => {
    const [row] = describeFields([
      { name: 'reviewItems', type: 'join', collection: 'agent-review-items', on: 'run' },
    ])
    expect(row.detail).toBe('← agent-review-items.run')
  })
})
