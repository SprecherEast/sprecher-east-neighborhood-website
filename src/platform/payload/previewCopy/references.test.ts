import { describe, expect, it } from 'vitest'

import { type BlockDef, namedFields, walkReferences } from './references'

/** The reference walk of the preview copy (#1396), on small synthetic field configs. */

const figure: BlockDef = {
  slug: 'figure',
  fields: [
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'title', type: 'text' },
  ],
}
const blocks = (slug: string) => (slug === 'figure' ? figure : undefined)
const only =
  (...allowed: string[]) =>
  ({ relationTo, id }: { relationTo: string; id: string | number }) =>
    allowed.includes(`${relationTo}:${id}`)

const run = (fields: unknown[], data: Record<string, unknown>, keep = only()) =>
  walkReferences({ fields: fields as never, data, blocks, keep })

const lexical = (...children: unknown[]) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children }] },
})
const editor = { editorConfig: { resolvedFeatureMap: new Map() } }

describe('walkReferences', () => {
  it('drops a single reference to something not copied, and keeps one that is', () => {
    const fields = [{ name: 'hero', type: 'upload', relationTo: 'media' }]
    expect(run(fields, { hero: 3 }, only('media:3'))).toEqual({ data: { hero: 3 }, dropped: 0 })
    expect(run(fields, { hero: 4 }, only('media:3'))).toEqual({ data: { hero: null }, dropped: 1 })
  })

  it('filters a list of references and counts each one dropped', () => {
    const fields = [{ name: 'related', type: 'relationship', relationTo: 'posts', hasMany: true }]
    expect(run(fields, { related: [1, 2, 3] }, only('posts:1', 'posts:3'))).toEqual({
      data: { related: [1, 3] },
      dropped: 1,
    })
  })

  it('reads a reference that can point at several collections', () => {
    const fields = [{ name: 'to', type: 'relationship', relationTo: ['pages', 'posts'] }]
    const keep = only('pages:1')
    expect(run(fields, { to: { relationTo: 'pages', value: 1 } }, keep).dropped).toBe(0)
    expect(run(fields, { to: { relationTo: 'posts', value: 9 } }, keep).data).toEqual({ to: null })
  })

  it('looks through rows, collapsibles, named and unnamed tabs, groups, arrays and blocks', () => {
    const fields = [
      { type: 'row', fields: [{ name: 'a', type: 'upload', relationTo: 'media' }] },
      {
        type: 'tabs',
        tabs: [
          { name: 'meta', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] },
          { label: 'Plain', fields: [{ name: 'b', type: 'upload', relationTo: 'media' }] },
        ],
      },
      {
        name: 'group',
        type: 'group',
        fields: [{ name: 'c', type: 'upload', relationTo: 'media' }],
      },
      {
        name: 'rows',
        type: 'array',
        fields: [{ name: 'd', type: 'upload', relationTo: 'media' }],
      },
      { name: 'layout', type: 'blocks', blocks: [figure] },
      { name: 'ref', type: 'blocks', blockReferences: ['figure'] },
    ]
    const data = {
      a: 1,
      meta: { image: 2 },
      b: 3,
      group: { c: 4 },
      rows: [{ d: 5 }],
      layout: [{ blockType: 'figure', image: 6, title: 'T' }],
      ref: [{ blockType: 'figure', image: 7 }],
    }
    const result = run(fields, data)
    expect(result.dropped).toBe(7)
    expect(JSON.stringify(result.data)).not.toMatch(/[1-7]/)
    expect(result.data.layout).toEqual([{ blockType: 'figure', image: null, title: 'T' }])
  })

  it('does not change what it was given', () => {
    const fields = [{ name: 'hero', type: 'upload', relationTo: 'media' }]
    const data = { hero: 1 }
    run(fields, data)
    expect(data).toEqual({ hero: 1 })
  })

  it('walks a rich-text upload, link and embedded block', () => {
    const fields = [{ name: 'body', type: 'richText', editor: { ...editor } }]
    const body = lexical(
      { type: 'upload', relationTo: 'media', value: 1 },
      {
        type: 'link',
        fields: { linkType: 'internal', doc: { relationTo: 'posts', value: 8 } },
        children: [{ type: 'text', text: 'a draft' }],
      },
    )
    const result = run(fields, { body }, only())
    expect(result.dropped).toBe(2)
    expect(result.data).toEqual({
      body: lexical({
        type: 'link',
        fields: { linkType: 'internal', doc: { relationTo: 'posts', value: null } },
        children: [{ type: 'text', text: 'a draft' }],
      }),
    })
  })

  it('keeps a rich-text link that is copied, and a custom one', () => {
    const fields = [{ name: 'body', type: 'richText', editor }]
    const body = lexical(
      {
        type: 'link',
        fields: { linkType: 'internal', doc: { relationTo: 'pages', value: 2 } },
        children: [],
      },
      { type: 'link', fields: { linkType: 'custom', url: 'https://example.com' }, children: [] },
    )
    expect(run(fields, { body }, only('pages:2'))).toEqual({ data: { body }, dropped: 0 })
  })

  it('walks the fields of an embedded block by the editor’s own block list', () => {
    const editorWithFigure = {
      editorConfig: {
        resolvedFeatureMap: new Map([
          ['blocks', { sanitizedServerFeatureProps: { blocks: [figure] } }],
        ]),
      },
    }
    const fields = [{ name: 'body', type: 'richText', editor: editorWithFigure }]
    const body = lexical({ type: 'block', fields: { blockType: 'figure', image: 5, title: 'T' } })
    const result = run(fields, { body })
    expect(result.dropped).toBe(1)
    expect(JSON.stringify(result.data)).toContain('"image":null')
  })

  it('fails closed on anything it does not know', () => {
    const rich = [{ name: 'body', type: 'richText', editor }]
    expect(() => run([{ name: 'x', type: 'mystery' }], { x: 1 })).toThrow(/unknown field type/)
    expect(() => run(rich, { body: lexical({ type: 'table' }) })).toThrow(/unknown rich-text node/)
    expect(() =>
      run(rich, { body: lexical({ type: 'block', fields: { blockType: 'nope' } }) }),
    ).toThrow(/block "nope"/)
    expect(() =>
      run(rich, { body: lexical({ type: 'upload', relationTo: 'media', value: { id: 1 } }) }),
    ).toThrow(/not an id/)
    expect(() => run(rich, { body: { notRoot: true } })).toThrow(/not a Lexical document/)
    const fields = [{ name: 'hero', type: 'upload', relationTo: 'media' }]
    expect(() => run(fields, { hero: { id: 1, alt: 'populated' } })).toThrow(/not an id/)
    expect(() => run([{ type: 'surprise', fields: [] }], {})).toThrow(/not a layout container/)
  })

  it('names layout containers’ children at the level above', () => {
    expect(
      namedFields([{ type: 'row', fields: [{ name: 'a', type: 'text' }] }] as never).map(
        (f) => f.name,
      ),
    ).toEqual(['a'])
  })
})
