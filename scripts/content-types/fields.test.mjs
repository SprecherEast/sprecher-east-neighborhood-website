import { describe, expect, it } from 'vitest'

import { describeFields } from './fields.mjs'

const locate = () => 'payload'

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

  it('marks a field hidden from the API as well as one hidden in Admin, once', () => {
    const rows = describeFields([
      { name: 'apiHidden', type: 'text', hidden: true },
      { name: 'both', type: 'text', hidden: true, admin: { hidden: true } },
    ])
    expect(rows.map((r) => r.notes)).toEqual([['hidden'], ['hidden']])
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
    expect(row.hooks).toEqual([{ phase: 'beforeChange', name: 'clean', note: '', file: 'payload' }])
  })

  it('shows field access functions named only by their key as inline', () => {
    const access = { read: () => true, update: () => false }
    const [row] = describeFields([{ name: 'role', type: 'select', options: ['a'], access }])
    expect(row.access).toEqual(['read: inline (always allows)', 'update: inline (always denies)'])
  })

  it('describes a join field by the collection and field it reads from', () => {
    const [row] = describeFields([
      { name: 'reviewItems', type: 'join', collection: 'agent-review-items', on: 'run' },
    ])
    expect(row.detail).toBe('← agent-review-items.run')
  })
})
